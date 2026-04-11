const express = require('express');
const admin = require('firebase-admin');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const DIDIT_API_KEY        = process.env.DIDIT_API_KEY;
const DIDIT_APP_ID         = '3938689d-7100-4e30-bd8a-7247b7d7a573';
const DIDIT_WORKFLOW_ID    = '55b2af26-9854-4e58-afb5-b8694183ca3a';
const DIDIT_WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET;
const WEBHOOK_URL          = 'https://didit-functions-933044287958.us-central1.run.app/diditWebhook';

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

// Raw body needed for webhook signature verification
app.use('/diditWebhook', express.raw({ type: '*/*' }));
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
    // Create Didit verification session
    const diditResponse = await fetch('https://apx.didit.me/v2/session/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIDIT_API_KEY}`
      },
      body: JSON.stringify({
        app_id: DIDIT_APP_ID,
        workflow_id: DIDIT_WORKFLOW_ID,
        vendor_data: customerId,
        redirect_url: 'https://www.forwardmymail.co.uk/customer-portal.html',
        callback_url: WEBHOOK_URL
      })
    });

    if (!diditResponse.ok) {
      const errText = await diditResponse.text();
      console.error('Didit API error:', diditResponse.status, errText);
      return res.status(500).json({ error: 'Failed to create verification session' });
    }

    const session = await diditResponse.json();
    console.log('Didit session created:', session.session_id, 'for customer:', customerId);

    // Update Firestore: mark as pending
    await db.collection('customers').doc(customerId).update({
      diditSessionId: session.session_id,
      idStatus: 'pending',
      idStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ sessionUrl: session.url });

  } catch (err) {
    console.error('createDiditSession error:', err);
    return res.status(500).json({ error: 'Internal error creating verification session' });
  }
});

// ── POST /diditWebhook ────────────────────────────────────────────────────────
// Called by Didit when verification is complete
app.post('/diditWebhook', async (req, res) => {
  try {
    // Verify webhook signature if secret is set
    if (DIDIT_WEBHOOK_SECRET) {
      const signature = req.headers['x-signature'] || req.headers['x-didit-signature'];
      if (!signature) {
        console.error('Missing Didit webhook signature');
        return res.status(401).send('Missing signature');
      }
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      const expectedSig = crypto
        .createHmac('sha256', DIDIT_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
      if (signature !== expectedSig && signature !== `sha256=${expectedSig}`) {
        console.error('Invalid Didit webhook signature');
        return res.status(401).send('Invalid signature');
      }
    }

    const payload = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    console.log('Didit webhook received:', payload?.type, payload?.status);

    const sessionId  = payload.session_id;
    const status     = (payload.status || '').toLowerCase();
    const customerId = payload.vendor_data;

    if (!customerId) {
      console.error('No vendor_data (customerId) in Didit webhook');
      return res.status(400).send('Missing vendor_data');
    }

    // Map Didit status → our idStatus
    let idStatus = 'pending';
    let idGate   = true;

    if (status === 'approved') {
      idStatus = 'approved';
      idGate   = false;
    } else if (['declined', 'rejected', 'expired'].includes(status)) {
      idStatus = 'declined';
      idGate   = true;
    }

    // Update Firestore
    await db.collection('customers').doc(customerId).update({
      idStatus,
      idGate,
      idStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      diditSessionId: sessionId,
      diditResult: payload
    });

    console.log(`Customer ${customerId} verification result: ${idStatus}`);

    // Send result email
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (customerDoc.exists) {
      const customer = customerDoc.data();
      if (idStatus === 'approved' || idStatus === 'declined') {
        await sendVerificationEmail(customer.email, customer.name || 'Customer', idStatus);
      }
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('diditWebhook error:', err);
    return res.status(500).send('Internal error');
  }
});

// ── Email helper ──────────────────────────────────────────────────────────────
async function sendVerificationEmail(email, name, result) {
  const isApproved = result === 'approved';
  const subject = isApproved
    ? 'Your Identity Has Been Verified — Forward My Mail'
    : 'Identity Verification Unsuccessful — Forward My Mail';

  const html = isApproved ? `
    <!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f5f5f5;}
      .container{max-width:600px;margin:0 auto;background:white;}
      .header{background:linear-gradient(135deg,#064e3b,#065f46);padding:40px 30px;text-align:center;}
      .header img{height:60px;}
      .body{padding:40px 30px;}
      .tick{font-size:64px;text-align:center;margin-bottom:20px;}
      h1{color:#064e3b;text-align:center;}
      .btn{display:block;width:fit-content;margin:24px auto;background:#f59e0b;color:#0b2a5b;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;}
      .footer{background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#999;}
    </style></head><body>
    <div class="container">
      <div class="header">
        <img src="https://www.forwardmymail.co.uk/logo.png" alt="Forward My Mail"/>
      </div>
      <div class="body">
        <div class="tick">✅</div>
        <h1>Identity Verified!</h1>
        <p>Hi ${name},</p>
        <p>Great news — your identity has been successfully verified. Your Forward My Mail portal is now fully active.</p>
        <p>You can now access your mail dashboard, request scans, and manage your mail.</p>
        <a href="https://www.forwardmymail.co.uk/customer-portal.html" class="btn">Go to Your Portal →</a>
      </div>
      <div class="footer">Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6LL</div>
    </div>
    </body></html>
  ` : `
    <!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f5f5f5;}
      .container{max-width:600px;margin:0 auto;background:white;}
      .header{background:linear-gradient(135deg,#7f1d1d,#991b1b);padding:40px 30px;text-align:center;}
      .header img{height:60px;}
      .body{padding:40px 30px;}
      .icon{font-size:64px;text-align:center;margin-bottom:20px;}
      h1{color:#7f1d1d;text-align:center;}
      .btn{display:block;width:fit-content;margin:24px auto;background:#991b1b;color:white;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;}
      .footer{background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#999;}
    </style></head><body>
    <div class="container">
      <div class="header">
        <img src="https://www.forwardmymail.co.uk/logo.png" alt="Forward My Mail"/>
      </div>
      <div class="body">
        <div class="icon">❌</div>
        <h1>Verification Unsuccessful</h1>
        <p>Hi ${name},</p>
        <p>Unfortunately your identity verification was not successful. This can happen for a number of reasons — in many cases a second attempt is all that's needed.</p>
        <p>Common reasons: blurry ID photo, ID out of frame, selfie didn't match, expired document, or poor lighting.</p>
        <a href="https://www.forwardmymail.co.uk/customer-portal.html" class="btn">Try Again →</a>
        <p>If you continue to have difficulty, email us at <a href="mailto:info@forwardmymail.co.uk">info@forwardmymail.co.uk</a></p>
      </div>
      <div class="footer">Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6LL</div>
    </div>
    </body></html>
  `;

  try {
    await transporter.sendMail({
      from: '"Forward My Mail" <info@forwardmymail.co.uk>',
      to: email,
      subject,
      html
    });
    console.log(`Verification ${result} email sent to ${email}`);
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Didit functions listening on port ${PORT}`));
