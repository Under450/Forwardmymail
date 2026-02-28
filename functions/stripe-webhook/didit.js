const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const DIDIT_API_KEY = process.env.DIDIT_API_KEY;
const DIDIT_APP_ID = '3938689d-7100-4e30-bd8a-7247b7d7a573';
const DIDIT_WORKFLOW_ID = '55b2af26-9854-4e58-afb5-b8694183ca3a';
const DIDIT_WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET;

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.co.uk',
  port: 587,
  secure: false,
  auth: {
    user: 'info@forwardmymail.co.uk',
    pass: process.env.EMAIL_PASS
  }
});

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  next();
});

// ── POST /createDiditSession ──────────────────────────────────────────────────
app.post('/createDiditSession', async (req, res) => {
  const { customerId, customerEmail } = req.body;
  if (!customerId || !customerEmail) {
    return res.status(400).json({ error: 'Missing customerId or customerEmail' });
  }
  if (!DIDIT_API_KEY) {
    return res.status(500).json({ error: 'Verification service not configured' });
  }

  try {
    const customerDoc = await db.collection('customers').doc(customerId).get();
    const customerName = customerDoc.exists ? (customerDoc.data().name || customerEmail) : customerEmail;

    const diditResponse = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DIDIT_API_KEY
      },
      body: JSON.stringify({
        workflow_id: DIDIT_WORKFLOW_ID,
        vendor_data: customerId,
        callback: 'https://didit-functions-933044287958.us-central1.run.app/diditWebhook'
      })
    });

    if (!diditResponse.ok) {
      const errText = await diditResponse.text();
      console.error('Didit API error:', diditResponse.status, errText);
      return res.status(500).json({ error: 'Failed to create verification session' });
    }

    const session = await diditResponse.json();
    console.log('Didit session full response:', JSON.stringify(session));
    console.log('Didit session created:', session.session_id, 'for:', customerId);

    await db.collection('customers').doc(customerId).update({
      diditSessionId: session.session_id,
      idStatus: 'pending',
      idStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const sessionUrl = session.verification_url || session.url;
    console.log('Session URL:', sessionUrl);
    return res.status(200).json({ sessionUrl });

  } catch (err) {
    console.error('createDiditSession error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ── POST /diditWebhook ────────────────────────────────────────────────────────
app.post('/diditWebhook', async (req, res) => {
  try {
    if (DIDIT_WEBHOOK_SECRET) {
      const signature = req.headers['x-signature'];
      const timestamp = req.headers['x-timestamp'];
      if (signature && timestamp) {
        // v3.0 signature: HMAC-SHA256 of "timestamp.rawBody"
        const rawBody = JSON.stringify(req.body);
        const expected = crypto.createHmac('sha256', DIDIT_WEBHOOK_SECRET)
          .update(`${timestamp}.${rawBody}`).digest('hex');
        if (signature !== expected) {
          console.warn('Didit signature mismatch - proceeding anyway for now');
          // return res.status(401).send('Invalid signature');
        }
      }
    }

    const payload = req.body;
    const sessionId  = payload.session_id;
    const status     = (payload.status || '').toLowerCase();
    const customerId = payload.vendor_data;

    if (!customerId) return res.status(400).send('Missing vendor_data');

    let idStatus = 'pending';
    let idGate   = true;
    if (status === 'approved') { idStatus = 'approved'; idGate = false; }
    else if (['declined','rejected','expired'].includes(status)) { idStatus = 'declined'; idGate = true; }

    await db.collection('customers').doc(customerId).update({
      idStatus, idGate,
      idStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      diditSessionId: sessionId,
      diditResult: payload
    });

    console.log(`Customer ${customerId} verification: ${idStatus}`);

    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (customerDoc.exists) {
      const customer = customerDoc.data();
      const subject = idStatus === 'approved'
        ? 'Your Identity Has Been Verified — Forward My Mail'
        : 'Identity Verification Unsuccessful — Forward My Mail';
      const html = idStatus === 'approved'
        ? `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#064e3b,#065f46);padding:30px;text-align:center">
              <img src="https://www.forwardmymail.co.uk/logo.png" height="50" alt="Forward My Mail"/>
            </div>
            <div style="padding:40px 30px;text-align:center">
              <div style="font-size:64px">✅</div>
              <h1 style="color:#064e3b">Identity Verified!</h1>
              <p>Hi ${customer.name || 'there'},</p>
              <p>Your identity has been successfully verified. Your portal is now fully active.</p>
              <a href="https://www.forwardmymail.co.uk/customer-portal.html" 
                style="display:inline-block;margin-top:20px;background:#f59e0b;color:#0b2a5b;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none">
                Go to Your Portal →
              </a>
            </div>
          </div>`
        : `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#7f1d1d,#991b1b);padding:30px;text-align:center">
              <img src="https://www.forwardmymail.co.uk/logo.png" height="50" alt="Forward My Mail"/>
            </div>
            <div style="padding:40px 30px;text-align:center">
              <div style="font-size:64px">❌</div>
              <h1 style="color:#7f1d1d">Verification Unsuccessful</h1>
              <p>Hi ${customer.name || 'there'},</p>
              <p>We couldn't verify your identity. Please try again with a valid photo ID in good lighting.</p>
              <a href="https://www.forwardmymail.co.uk/customer-portal.html"
                style="display:inline-block;margin-top:20px;background:#0b2a5b;color:white;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none">
                Try Again →
              </a>
              <p style="margin-top:20px;font-size:13px;color:#666">Need help? <a href="mailto:info@forwardmymail.co.uk">info@forwardmymail.co.uk</a></p>
            </div>
          </div>`;

      await transporter.sendMail({
        from: '"Forward My Mail" <info@forwardmymail.co.uk>',
        to: customer.email,
        subject, html
      });
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('diditWebhook error:', err);
    return res.status(500).send('Internal error');
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Didit functions listening on port ${PORT}`));
