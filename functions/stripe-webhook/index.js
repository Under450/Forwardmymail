const stream = require('stream');
const functions = require('firebase-functions');
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const serviceAccount = require('./serviceAccountKey.json');

// ─────────────────────────────────────────────────────────────────────────────
// SECRETS — never hardcoded here. Set as environment variables in Google Cloud.
// See SECRETS.md in this folder for setup instructions.
// ─────────────────────────────────────────────────────────────────────────────
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const EMAIL_PASS     = process.env.EMAIL_PASS;

admin.initializeApp();
const db = admin.firestore();

// ── Google Sheets setup ──────────────────────────────────────────────────────
const SHEET_ID = '1M4sf4aRxYB8ZXjVE2qL3owJROxKBPikEMxK_1lKGrlc';
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function syncCustomerToSheet(customerId, customerData) {
  try {
    const values = [[
      customerData.name || '',
      customerData.email || '',
      customerData.company || '',
      customerData.mailboxId || '',
      customerData.package || 'None',
      customerData.credits || 0,
      customerData.totalSpent || 0,
      customerData.lastPurchaseDate ? new Date(customerData.lastPurchaseDate.toDate()).toLocaleDateString() : '',
      customerData.created ? new Date(customerData.created.toDate()).toLocaleDateString() : '',
      ''
    ]];

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!B:B',
    });

    const emailsList = response.data.values || [];
    const rowIndex = emailsList.findIndex(row => row[0] === customerData.email);

    if (rowIndex >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Sheet1!A${rowIndex + 2}:J${rowIndex + 2}`,
        valueInputOption: 'RAW',
        resource: { values },
      });
      console.log(`Updated existing row for ${customerData.email}`);
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Sheet1!A:J',
        valueInputOption: 'RAW',
        resource: { values },
      });
      console.log(`Added new row for ${customerData.email}`);
    }
  } catch (error) {
    console.error('Error syncing to Google Sheets:', error);
  }
}

// ── Email transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.co.uk',
  port: 587,
  secure: false,
  auth: {
    user: 'info@forwardmymail.co.uk',
    pass: EMAIL_PASS
  }
});

function buildWelcomeEmail(name, company) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to Forward My Mail</title><style> * { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f0f4f8; -webkit-font-smoothing: antialiased; } .wrapper { max-width: 620px; margin: 0 auto; background: white; } .header { background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 45px 30px; text-align: center; } .header-logo { margin-bottom: 18px; } .header h1 { font-size: 28px; font-weight: 800; color: white; margin-bottom: 8px; } .header p { color: rgba(255,255,255,0.8); font-size: 15px; } .content { padding: 40px 30px; } .greeting { font-size: 17px; color: #334155; line-height: 1.7; margin-bottom: 25px; } .highlight-box { background: #eff6ff; border-left: 4px solid #1e3a8a; border-radius: 0 10px 10px 0; padding: 20px 22px; margin: 25px 0; } .highlight-box p { color: #1e3a8a; font-weight: 600; font-size: 15px; line-height: 1.6; margin: 0; } .address-card { background: #1e3a8a; border-radius: 14px; padding: 28px; margin: 28px 0; text-align: center; } .address-card .label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 14px; } .address-card .name-line { font-size: 17px; color: white; font-weight: 700; margin-bottom: 4px; } .address-card .address { font-size: 15px; color: rgba(255,255,255,0.85); font-weight: 500; line-height: 2; } .didit-box { background: #fefce8; border: 2px solid #fbbf24; border-radius: 12px; padding: 22px; margin: 25px 0; } .didit-box .didit-label { font-size: 12px; font-weight: 700; color: #92400e; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px; } .didit-box p { font-size: 15px; color: #78350f; line-height: 1.7; margin: 0; } .didit-name { font-weight: 800; color: #92400e; } .steps-title { font-size: 18px; font-weight: 700; color: #1e3a8a; margin: 32px 0 18px; } .step { display: flex; align-items: flex-start; margin-bottom: 14px; padding: 18px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; } .step.highlight-step { background: #fefce8; border-color: #fbbf24; } .step-num { width: 34px; height: 34px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; flex-shrink: 0; margin-right: 14px; margin-top: 2px; } .highlight-step .step-num { background: #d97706; } .step-text h4 { font-size: 15px; color: #1a1a1a; margin-bottom: 4px; font-weight: 600; } .step-text p { font-size: 13px; color: #64748b; line-height: 1.5; margin: 0; } .cta-btn { display: block; background: #1e3a8a; color: white; text-decoration: none; text-align: center; padding: 17px 30px; border-radius: 10px; font-size: 16px; font-weight: 700; margin: 28px 0; box-shadow: 0 4px 14px rgba(30,58,138,0.25); } .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px 30px; text-align: center; } .footer p { font-size: 12px; color: #94a3b8; line-height: 1.8; } .footer strong { color: #64748b; } .footer a { color: #1e3a8a; text-decoration: none; } </style></head><body><div class="wrapper"><div class="header"><div class="header-logo"><img src="data:image/png;base64,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" alt="Forward My Mail" width="160" height="61" style="display:block;margin:0 auto 16px;background:white;padding:8px 14px;border-radius:10px;" /></div><h1>Welcome aboard! 👋</h1><p>Your account has been created successfully</p></div><div class="content"><p class="greeting"> Hi <strong>${name}</strong>${company ? " — <strong>" + company + "</strong>" : ""},<br><br> Thank you for registering with Forward My Mail. Your account is set up and your UK business address is reserved and ready for you. </p><div class="highlight-box"><p>Your address is reserved. To activate it fully, you will need to complete a quick identity verification — details are below.</p></div><div class="address-card"><div class="label">Your UK Business Address</div><div class="name-line">${name}${company ? " / " + company : ""}</div><div class="address"> 8a Bore Street<br> Lichfield, Staffordshire<br> WS13 6PS<br> United Kingdom </div></div><div class="didit-box"><div class="didit-label">⚠ Action Required — Identity Verification</div><p>To activate your account, you need to complete a quick identity check. <strong>Click the button below to go to your portal</strong> — the verification panel will be waiting for you. It takes under 2 minutes using your passport or driving licence.</p></div><a href="https://www.forwardmymail.co.uk/customer-portal.html#verify" class="cta-btn" style="background:#d97706;">Complete Your Identity Verification →</a><div class="steps-title">Getting started</div><div class="step highlight-step"><div class="step-num">1</div><div class="step-text"><h4>Complete your identity verification</h4><p>Click the button above to go to your portal — the verification panel will guide you through scanning your ID and taking a quick selfie. Takes under 2 minutes.</p></div></div><div class="step"><div class="step-num">2</div><div class="step-text"><h4>Log in to your portal</h4><p>Once verified, log in to manage your mail, choose a package and top up credits</p></div></div><div class="step"><div class="step-num">3</div><div class="step-text"><h4>Start using your address</h4><p>Use it for business registration, HMRC, Companies House, banking or any correspondence</p></div></div><div class="step"><div class="step-num">4</div><div class="step-text"><h4>We handle the rest</h4><p>When mail arrives we'll notify you instantly — scan, forward, keep or shred from your portal</p></div></div><a href="https://www.forwardmymail.co.uk/customer-portal.html" class="cta-btn">Go to Your Portal →</a></div><div class="footer"><p><strong>Forward My Mail Ltd</strong><br> 8a Bore Street, Lichfield, Staffordshire, WS13 6PS<br> Company No. 16912540<br><br> Questions? <a href="/cdn-cgi/l/email-protection#325b5c545d72545d40455340565f4b5f535b5e1c515d1c4759"><span class="__cf_email__" data-cfemail="`;
}


function buildCreditPackEmail(name, company, creditsAdded, newBalance, amount) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Credits Added — Forward My Mail</title><style> * { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f0f4f8; -webkit-font-smoothing: antialiased; } .wrapper { max-width: 620px; margin: 0 auto; background: white; } .header { background: linear-gradient(135deg, #065f46 0%, #059669 100%); padding: 45px 30px; text-align: center; } .header-logo { margin-bottom: 18px; } .header h1 { font-size: 28px; font-weight: 800; color: white; margin-bottom: 8px; } .header p { color: rgba(255,255,255,0.85); font-size: 15px; } .content { padding: 40px 30px; } .greeting { font-size: 16px; color: #334155; line-height: 1.8; margin-bottom: 25px; } .credit-card { background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); border-radius: 16px; padding: 32px; text-align: center; margin: 25px 0; } .credit-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; } .credit-amount { font-size: 64px; font-weight: 800; color: white; line-height: 1; } .credit-unit { font-size: 20px; font-weight: 700; color: rgba(255,255,255,0.8); margin-top: 4px; } .credit-balance { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 14px; color: rgba(255,255,255,0.75); } .credit-balance strong { color: white; font-size: 16px; } .summary-box { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 12px; padding: 22px; margin: 25px 0; } .summary-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #dcfce7; font-size: 14px; color: #334155; } .summary-row:last-child { border-bottom: none; font-weight: 700; color: #065f46; font-size: 15px; } .summary-row span:last-child { font-weight: 600; } .what-can-do { background: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0; border: 1px solid #e2e8f0; } .what-can-do h4 { font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px; } .action-item { display: flex; align-items: center; padding: 9px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155; } .action-item:last-child { border-bottom: none; } .action-item .icon { font-size: 18px; margin-right: 12px; flex-shrink: 0; } .action-item .cost { margin-left: auto; font-size: 12px; color: #64748b; background: #e2e8f0; padding: 2px 8px; border-radius: 10px; font-weight: 600; } .cta-btn { display: block; background: #1e3a8a; color: white; text-decoration: none; text-align: center; padding: 17px 30px; border-radius: 10px; font-size: 16px; font-weight: 700; margin: 28px 0; box-shadow: 0 4px 14px rgba(30,58,138,0.25); } .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px 30px; text-align: center; } .footer p { font-size: 12px; color: #94a3b8; line-height: 1.8; } .footer strong { color: #64748b; } .footer a { color: #1e3a8a; text-decoration: none; } </style></head><body><div class="wrapper"><div class="header"><div class="header-logo"><img src="data:image/png;base64,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" alt="Forward My Mail" width="160" height="61" style="display:block;margin:0 auto 16px;background:white;padding:8px 14px;border-radius:10px;" /></div><h1>Credits added ✓</h1><p>Your account has been topped up successfully</p></div><div class="content"><p class="greeting"> Hi <strong>${name}</strong>${company ? " — <strong>" + company + "</strong>" : ""},<br><br> Your credit pack purchase was successful. Your credits are now available in your portal — use them to scan, forward or manage your mail. </p><div class="credit-card"><div class="credit-label">Credits Added</div><div class="credit-amount">£${creditsAdded}</div><div class="credit-unit">credits</div><div class="credit-balance">New balance: <strong>£${newBalance}</strong></div></div><div class="summary-box"><div class="summary-row"><span>Pack purchased</span><span>£${amount} Credit Pack</span></div><div class="summary-row"><span>Payment method</span><span>Card</span></div><div class="summary-row"><span>Total charged</span><span>£${amount}</span></div></div><div class="what-can-do"><h4>What you can do with credits</h4><div class="action-item"><span class="icon">📄</span>Scan &amp; email a letter or document<span class="cost">£2</span></div><div class="action-item"><span class="icon">📦</span>Forward mail to your address<span class="cost">£3–8</span></div><div class="action-item"><span class="icon">🗄️</span>Keep item in storage<span class="cost">£1/mo</span></div><div class="action-item"><span class="icon">🗑️</span>Shred &amp; dispose securely<span class="cost">£1</span></div></div><a href="https://www.forwardmymail.co.uk/customer-portal.html" class="cta-btn">Manage Your Mail →</a></div><div class="footer"><p><strong>Forward My Mail Ltd</strong><br> 8a Bore Street, Lichfield, Staffordshire, WS13 6PS<br> Company No. 16912540<br><br> Questions? <a href="mailto:info@forwardmymail.co.uk">info@forwardmymail.co.uk</a></p></div></div></body></html>`;
}

function buildPackageEmail(name, company, packageType, amount) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to Your Mailbox — Forward My Mail</title><style> * { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f0f4f8; -webkit-font-smoothing: antialiased; } .wrapper { max-width: 620px; margin: 0 auto; background: white; } .header { background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 45px 30px; text-align: center; } .header-logo { margin-bottom: 18px; } .header h1 { font-size: 28px; font-weight: 800; color: white; margin-bottom: 8px; } .header p { color: rgba(255,255,255,0.8); font-size: 15px; } .content { padding: 40px 30px; } .greeting { font-size: 16px; color: #334155; line-height: 1.8; margin-bottom: 25px; } .package-badge { text-align: center; margin: 25px 0; } .package-badge .badge { display: inline-block; background: #fbbf24; color: #78350f; font-size: 13px; font-weight: 800; padding: 6px 18px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 14px; } .address-card { background: #1e3a8a; border-radius: 14px; padding: 28px; margin: 25px 0; text-align: center; } .address-card .label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 14px; } .address-card .name-line { font-size: 17px; color: white; font-weight: 700; margin-bottom: 4px; } .address-card .address { font-size: 15px; color: rgba(255,255,255,0.85); font-weight: 500; line-height: 2; } .summary-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 12px; padding: 22px; margin: 25px 0; } .summary-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #dbeafe; font-size: 14px; color: #334155; } .summary-row:last-child { border-bottom: none; font-weight: 700; color: #1e3a8a; font-size: 15px; } .summary-row span:last-child { font-weight: 600; } .highlight-box { background: #fefce8; border: 2px solid #fbbf24; border-radius: 12px; padding: 20px; margin: 25px 0; } .highlight-box p { font-size: 15px; color: #78350f; line-height: 1.7; margin: 0; } .steps-title { font-size: 18px; font-weight: 700; color: #1e3a8a; margin: 32px 0 18px; } .step { display: flex; align-items: flex-start; margin-bottom: 14px; padding: 18px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; } .step-num { width: 34px; height: 34px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; flex-shrink: 0; margin-right: 14px; margin-top: 2px; } .step-text h4 { font-size: 15px; color: #1a1a1a; margin-bottom: 4px; font-weight: 600; } .step-text p { font-size: 13px; color: #64748b; line-height: 1.5; margin: 0; } .cta-btn { display: block; background: #1e3a8a; color: white; text-decoration: none; text-align: center; padding: 17px 30px; border-radius: 10px; font-size: 16px; font-weight: 700; margin: 28px 0; box-shadow: 0 4px 14px rgba(30,58,138,0.25); } .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px 30px; text-align: center; } .footer p { font-size: 12px; color: #94a3b8; line-height: 1.8; } .footer strong { color: #64748b; } .footer a { color: #1e3a8a; text-decoration: none; } </style></head><body><div class="wrapper"><div class="header"><div class="header-logo"><img src="data:image/png;base64,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" alt="Forward My Mail" width="160" height="61" style="display:block;margin:0 auto 16px;background:white;padding:8px 14px;border-radius:10px;" /></div><h1>You're all set! 🎉</h1><p>Your mailbox subscription is confirmed</p></div><div class="content"><p class="greeting"> Hi <strong>${name}</strong>${company ? " — <strong>" + company + "</strong>" : ""},<br><br> Thank you for your subscription. Your UK business address is now active and ready to use. Here's everything you need to get started. </p><div class="package-badge"><div class="badge">${packageType}</div></div><div class="address-card"><div class="label">Your UK Business Address</div><div class="name-line">${name}${company ? " / " + company : ""}</div><div class="address"> 8a Bore Street<br> Lichfield, Staffordshire<br> WS13 6PS<br> United Kingdom </div></div><div class="summary-box"><div class="summary-row"><span>Package</span><span>${packageType}</span></div><div class="summary-row"><span>Payment</span><span>£${amount} / year</span></div><div class="summary-row"><span>Status</span><span>✓ Active</span></div></div><div class="highlight-box"><p>To start receiving mail at this address, add some credits to your account. Credits are used when you request scans, forwarding or other mail actions.</p></div><div class="steps-title">Getting started</div><div class="step"><div class="step-num">1</div><div class="step-text"><h4>Start using your address</h4><p>Use it for HMRC, Companies House, banks, or any business correspondence</p></div></div><div class="step"><div class="step-num">2</div><div class="step-text"><h4>Top up credits</h4><p>Add credits from your portal — used to scan, forward or manage your mail</p></div></div><div class="step"><div class="step-num">3</div><div class="step-text"><h4>We notify you on every arrival</h4><p>Get instant email alerts when mail arrives — then choose what to do from your portal</p></div></div><a href="https://www.forwardmymail.co.uk/customer-portal.html" class="cta-btn">Go to Your Portal →</a></div><div class="footer"><p><strong>Forward My Mail Ltd</strong><br> 8a Bore Street, Lichfield, Staffordshire, WS13 6PS<br> Company No. 16912540<br><br> Questions? <a href="mailto:info@forwardmymail.co.uk">info@forwardmymail.co.uk</a></p></div></div></body></html>`;
}

async function sendWelcomeEmail(email, name, mailboxId, company) {
  const html = buildWelcomeEmail(name, company || '');
  try {
    await transporter.sendMail({
      from: '"Forward My Mail" <info@forwardmymail.co.uk>',
      to: email,
      subject: 'Welcome to Forward My Mail — Your Mailbox is Ready',
      html
    });
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
}

// ── createCheckoutSession ────────────────────────────────────────────────────
exports.createCheckoutSession = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { amount, customerId, customerEmail } = req.body;

      if (!amount || !customerId || !customerEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const customerRef = db.collection('customers').doc(customerId);
      const customerDoc = await customerRef.get();

      if (!customerDoc.exists) {
        console.log(`Customer ${customerId} not found, creating now...`);
        await customerRef.set({
          email: customerEmail,
          name: customerEmail.split('@')[0],
          credits: 0,
          created: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Created customer document for ${customerEmail}`);
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `£${amount} Credit Pack`,
              description: 'Mail scanning credits for Forward My Mail',
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: 'https://forwardmymail.co.uk/customer-portal.html?success=true',
        cancel_url: 'https://forwardmymail.co.uk/customer-portal.html?cancelled=true',
        client_reference_id: customerId,
        customer_email: customerEmail,
        metadata: {
          customerId: customerId,
          amount: amount.toString(),
          customerEmail: customerEmail,
        },
      });

      return res.status(200).json({ id: session.id });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// ── stripeWebhook ────────────────────────────────────────────────────────────
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (!WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET env var not set');
    return res.status(500).send('Webhook secret not configured');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      let customerId = session.metadata?.customerId;
      let amount = session.metadata?.amount ? parseFloat(session.metadata.amount) : null;
      // Payment Links use customer_details.email; programmatic checkout uses customer_email
      const customerEmail = session.customer_details?.email
        || session.customer_email
        || session.metadata?.customerEmail;

      if (!amount && session.amount_total) {
        amount = session.amount_total / 100;
      }

      if (!amount || !customerEmail) {
        console.error('Missing required data - amount:', amount, 'email:', customerEmail,
          'customer_details:', session.customer_details,
          'customer_email:', session.customer_email,
          'amount_total:', session.amount_total);
        return res.status(400).send('Missing required data');
      }

      if (!customerId) {
        const existingCustomers = await db.collection('customers')
          .where('email', '==', customerEmail)
          .limit(1)
          .get();

        if (!existingCustomers.empty) {
          customerId = existingCustomers.docs[0].id;
          console.log(`Found existing customer by email: ${customerId}`);
        }
      }

      if (!customerId) {
        const newCustomerRef = db.collection('customers').doc();
        customerId = newCustomerRef.id;
        await newCustomerRef.set({
          email: customerEmail,
          name: customerEmail.split('@')[0],
          credits: 0,
          created: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Created new customer ${customerId} for ${customerEmail}`);
      }

      // Map payment amounts to package types
      // Credit packs: £10, £20, £25, £30, £50 — credits added equal to amount
      // Subscriptions: no credits added, just package type updated
      let packageType = 'Credit Pack';
      let creditsToAdd = amount;

      if (amount === 99)       { packageType = 'Personal Mailbox';    creditsToAdd = 0; }
      else if (amount === 149) { packageType = 'Business Address';    creditsToAdd = 0; }
      else if (amount === 189) { packageType = 'Registered Office';   creditsToAdd = 0; }
      else if (amount === 299) { packageType = 'Full Virtual Office'; creditsToAdd = 0; }

      const customerRef = db.collection('customers').doc(customerId);
      const customerDoc = await customerRef.get();

      if (!customerDoc.exists) {
        console.error(`Customer ${customerId} not found after creation attempt`);
        return res.status(500).send('Customer creation failed');
      }

      const customerData = customerDoc.data();
      const currentCredits = customerData.credits || 0;
      const newCredits = currentCredits + creditsToAdd;

      await customerRef.update({
        credits: newCredits,
        lastPurchaseDate: admin.firestore.FieldValue.serverTimestamp(),
        package: packageType,
        totalSpent: (customerData.totalSpent || 0) + amount,
      });

      await db.collection('transactions').add({
        customerId: customerId,
        type: 'credit_purchase',
        amount: amount,
        previousBalance: currentCredits,
        newBalance: newCredits,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Added £${amount} to customer ${customerId}. New balance: £${newCredits}`);

      const finalCustomerData = (await customerRef.get()).data();

      // Confirmation email to customer
      try {
        const emailName = finalCustomerData.name || 'Customer';
        const emailCompany = finalCustomerData.company || '';
        let emailSubject, emailHtml;

        if (creditsToAdd > 0) {
          // Credit pack purchase
          emailSubject = `£${creditsToAdd} credits added to your Forward My Mail account`;
          emailHtml = buildCreditPackEmail(emailName, emailCompany, creditsToAdd, newCredits, amount);
        } else {
          // Package/subscription purchase
          emailSubject = `${packageType} confirmed — your mailbox is active`;
          emailHtml = buildPackageEmail(emailName, emailCompany, packageType, amount);
        }

        await transporter.sendMail({
          from: '"Forward My Mail" <info@forwardmymail.co.uk>',
          to: finalCustomerData.email,
          subject: emailSubject,
          html: emailHtml
        });
        console.log(`Purchase confirmation email (${creditsToAdd > 0 ? 'credit pack' : 'package'}) sent to ${finalCustomerData.email}`);
      } catch (emailError) {
        console.error('Failed to send customer email:', emailError);
      }

      // Admin notification
      try {
        await transporter.sendMail({
          from: '"Forward My Mail" <info@forwardmymail.co.uk>',
          to: 'info@forwardmymail.co.uk',
          subject: `New Purchase: £${amount} - ${finalCustomerData.name}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5"><div style="background:white;padding:30px;border-radius:10px;border-left:4px solid #4CAF50"><h2 style="color:#4CAF50;margin-top:0">New Purchase Received</h2><table style="width:100%;border-collapse:collapse;margin:20px 0"><tr style="background:#f9f9f9"><td style="padding:12px;border-bottom:1px solid #ddd"><strong>Customer:</strong></td><td style="padding:12px;border-bottom:1px solid #ddd">${finalCustomerData.name}</td></tr><tr><td style="padding:12px;border-bottom:1px solid #ddd"><strong>Email:</strong></td><td style="padding:12px;border-bottom:1px solid #ddd"><a href="mailto:${finalCustomerData.email}">${finalCustomerData.email}</a></td></tr><tr style="background:#f9f9f9"><td style="padding:12px;border-bottom:1px solid #ddd"><strong>Amount:</strong></td><td style="padding:12px;border-bottom:1px solid #ddd;color:#4CAF50;font-size:18px;font-weight:bold">£${amount}</td></tr><tr><td style="padding:12px;border-bottom:1px solid #ddd"><strong>New Balance:</strong></td><td style="padding:12px;border-bottom:1px solid #ddd">£${newCredits}</td></tr><tr style="background:#f9f9f9"><td style="padding:12px;border-bottom:1px solid #ddd"><strong>Mailbox ID:</strong></td><td style="padding:12px;border-bottom:1px solid #ddd"><span style="background:#1e3c72;color:white;padding:4px 8px;border-radius:4px;font-weight:bold">${finalCustomerData.mailboxId || 'Not assigned'}</span></td></tr></table><div style="background:#f0f0f0;padding:15px;border-radius:5px;margin-top:20px"><p style="margin:0;font-size:12px;color:#666"><strong>Stripe Session:</strong><br>${session.id}</p></div></div></div>`
        });
        console.log('Admin notification sent');
      } catch (notifyError) {
        console.error('Failed to send admin notification:', notifyError);
      }

      await syncCustomerToSheet(customerId, finalCustomerData);

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).send('Error processing webhook');
    }
  }

  res.status(200).json({ received: true });
});

// ── sendWelcomeEmail (callable) ──────────────────────────────────────────────
exports.sendWelcomeEmail = functions.https.onCall(async (data, context) => {
  const { email, name, mailboxId } = data;

  if (!email || !name || !mailboxId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  await sendWelcomeEmail(email, name, mailboxId);
  return { success: true };
});

// ── onCustomerCreated (admin signup notification) ────────────────────────────
exports.onCustomerCreated = onDocumentCreated('customers/{customerId}', async (event) => {
  try {
    const customerData = event.data.data();

    // Wait briefly for mailboxId to be written (generated client-side on signup)
    let mailboxId = customerData.mailboxId;
    let attempts = 0;
    while (!mailboxId && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const updatedDoc = await event.data.ref.get();
      mailboxId = updatedDoc.data().mailboxId;
      attempts++;
    }

    const companyName = customerData.company || customerData.name;

    await transporter.sendMail({
      from: '"Forward My Mail" <info@forwardmymail.co.uk>',
      to: 'info@forwardmymail.co.uk',
      subject: `New Account: ${companyName}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5"><div style="background:white;padding:30px;border-radius:10px;border-left:4px solid #1e3c72"><div style="display:flex;align-items:center;margin-bottom:20px"><img src="https://forwardmymail.co.uk/logo.png" style="max-width:150px;height:auto;margin-right:15px" alt="Forward My Mail"><h2 style="color:#1e3c72;margin:0;font-size:18px">NEW ACCOUNT: ${companyName.toUpperCase()}</h2></div><table style="width:100%;border-collapse:collapse;margin:20px 0"><tr style="background:#f9f9f9"><td style="padding:12px;border-bottom:1px solid #ddd"><strong>Name:</strong></td><td style="padding:12px;border-bottom:1px solid #ddd">${customerData.name}</td></tr><tr><td style="padding:12px;border-bottom:1px solid #ddd"><strong>Email:</strong></td><td style="padding:12px;border-bottom:1px solid #ddd"><a href="mailto:${customerData.email}">${customerData.email}</a></td></tr><tr style="background:#f9f9f9"><td style="padding:12px;border-bottom:1px solid #ddd"><strong>Company:</strong></td><td style="padding:12px;border-bottom:1px solid #ddd">${customerData.company || 'N/A'}</td></tr><tr><td style="padding:12px;border-bottom:1px solid #ddd"><strong>Credits:</strong></td><td style="padding:12px;border-bottom:1px solid #ddd">£${customerData.credits || 0}</td></tr><tr style="background:#f9f9f9"><td style="padding:12px;border-bottom:1px solid #ddd"><strong>Mailbox ID:</strong></td><td style="padding:12px;border-bottom:1px solid #ddd"><span style="background:#1e3c72;color:white;padding:4px 8px;border-radius:4px;font-weight:bold">${mailboxId || 'Pending'}</span></td></tr></table><p style="margin-top:20px;padding:15px;background:#fff3cd;border-left:4px solid #ffc107;border-radius:4px"><strong>Action Required:</strong> Customer has signed up but has not purchased credits yet.</p></div></div>`
    });

    console.log(`Signup notification sent for ${customerData.email}`);

    // Sync new customer to Google Sheets
    const finalData = { ...customerData, mailboxId };
    await syncCustomerToSheet(event.params.customerId, finalData);
    console.log(`New customer synced to Google Sheets: ${customerData.email}`);
  } catch (error) {
    console.error('Error in onCustomerCreated:', error);
  }
});

// ── greyOutDeletedCustomer (Sheets housekeeping) ─────────────────────────────
exports.greyOutDeletedCustomer = onDocumentDeleted('customers/{customerId}', async (event) => {
  try {
    const deletedData = event.data.data();
    const email = deletedData.email;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!B:B',
    });

    const emailsArray = response.data.values || [];
    let rowIndex = -1;

    for (let i = emailsArray.length - 1; i >= 0; i--) {
      if (emailsArray[i][0] === email) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex >= 0) {
      const actualRow = rowIndex + 2;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: {
          requests: [{
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: actualRow - 1,
                endRowIndex: actualRow,
                startColumnIndex: 0,
                endColumnIndex: 10
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
                }
              },
              fields: 'userEnteredFormat.backgroundColor'
            }
          }]
        }
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Sheet1!J${actualRow}`,
        valueInputOption: 'RAW',
        resource: { values: [['DELETED']] },
      });

      console.log(`Greyed out deleted customer: ${email}`);
    }
  } catch (error) {
    console.error('Error greying out deleted customer:', error);
  }
});

// ── createDiditSession ────────────────────────────────────────────────────────
// Called by customer portal when customer clicks "Complete Your ID Verification"
// Creates a Didit verification session and returns the session URL
exports.createDiditSession = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const DIDIT_API_KEY = process.env.DIDIT_API_KEY;
  const DIDIT_APP_ID  = '3938689d-7100-4e30-bd8a-7247b7d7a573';
  const DIDIT_WORKFLOW_ID = '55b2af26-9854-4e58-afb5-b8694183ca3a';

  if (!DIDIT_API_KEY) {
    console.error('DIDIT_API_KEY not set');
    return res.status(500).json({ error: 'Verification service not configured' });
  }

  const { customerId, customerEmail } = req.body;
  if (!customerId || !customerEmail) {
    return res.status(400).json({ error: 'Missing customerId or customerEmail' });
  }

  try {
    // Get customer name from Firestore
    const customerDoc = await db.collection('customers').doc(customerId).get();
    const customerName = customerDoc.exists ? (customerDoc.data().name || customerEmail) : customerEmail;

    // Create Didit session
    const diditResponse = await fetch('https://apx.didit.me/v2/session/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIDIT_API_KEY}`
      },
      body: JSON.stringify({
        app_id: DIDIT_APP_ID,
        workflow_id: DIDIT_WORKFLOW_ID,
        vendor_data: customerId,  // pass Firebase UID so webhook can identify customer
        redirect_url: 'https://www.forwardmymail.co.uk/customer-portal.html',
        callback_url: 'https://us-central1-forward-my-mail.cloudfunctions.net/diditWebhook'
      })
    });

    if (!diditResponse.ok) {
      const errText = await diditResponse.text();
      console.error('Didit API error:', diditResponse.status, errText);
      return res.status(500).json({ error: 'Failed to create verification session' });
    }

    const session = await diditResponse.json();
    console.log('Didit session created:', session.session_id, 'for customer:', customerId);

    // Store session ID on customer doc
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

// ── diditWebhook ──────────────────────────────────────────────────────────────
// Called by Didit when verification is complete (approved or declined)
// Updates customer Firestore doc and lifts or keeps the gate
exports.diditWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const DIDIT_WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET;

  try {
    // Verify webhook signature if secret is configured
    if (DIDIT_WEBHOOK_SECRET) {
      const signature = req.headers['x-signature'] || req.headers['x-didit-signature'];
      if (!signature) {
        console.error('Missing Didit webhook signature');
        return res.status(401).send('Missing signature');
      }
      const crypto = require('crypto');
      const expectedSig = crypto
        .createHmac('sha256', DIDIT_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (signature !== expectedSig && signature !== `sha256=${expectedSig}`) {
        console.error('Invalid Didit webhook signature');
        return res.status(401).send('Invalid signature');
      }
    }

    const payload = req.body;
    console.log('Didit webhook received:', JSON.stringify(payload));

    // Extract key fields
    const sessionId   = payload.session_id;
    const status      = (payload.status || '').toLowerCase();      // approved / declined / expired
    const customerId  = payload.vendor_data;                        // Firebase UID we passed in

    if (!customerId) {
      console.error('No vendor_data (customerId) in Didit webhook payload');
      return res.status(400).send('Missing vendor_data');
    }

    // Map Didit status to our idStatus values
    let idStatus = 'pending';
    let idGate   = true;

    if (status === 'approved') {
      idStatus = 'approved';
      idGate   = false;   // lift the gate!
    } else if (status === 'declined' || status === 'rejected' || status === 'expired') {
      idStatus = 'declined';
      idGate   = true;    // keep gate, customer needs to retry
    }

    // Update customer Firestore document
    await db.collection('customers').doc(customerId).update({
      idStatus,
      idGate,
      idStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      diditSessionId: sessionId,
      diditResult: payload
    });

    console.log(`Customer ${customerId} verification result: ${idStatus}`);

    // Send appropriate email via IONOS SMTP
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (customerDoc.exists) {
      const customer = customerDoc.data();
      if (idStatus === 'approved') {
        await sendVerificationEmail(customer.email, customer.name || 'Customer', 'approved');
      } else if (idStatus === 'declined') {
        await sendVerificationEmail(customer.email, customer.name || 'Customer', 'declined');
      }
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('diditWebhook error:', err);
    return res.status(500).send('Internal error');
  }
});

// ── sendVerificationEmail helper ──────────────────────────────────────────────
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
      <div class="footer">Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6PS</div>
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
      .btn{display:block;width:fit-content;margin:24px auto;background:#0b2a5b;color:white;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;}
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
        <p>Unfortunately we were unable to verify your identity. Your portal remains locked until verification is completed successfully.</p>
        <p><strong>Common reasons for failure:</strong> blurry photo, expired ID, poor lighting, or face not matching ID.</p>
        <p>Please try again — make sure you're in good lighting with a valid, unexpired photo ID.</p>
        <a href="https://www.forwardmymail.co.uk/customer-portal.html" class="btn">Try Again →</a>
        <p style="margin-top:20px;font-size:13px;color:#666;">Need help? Email us at <a href="mailto:info@forwardmymail.co.uk">info@forwardmymail.co.uk</a></p>
      </div>
      <div class="footer">Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6PS</div>
    </div>
    </body></html>
  `;

  await transporter.sendMail({
    from: '"Forward My Mail" <info@forwardmymail.co.uk>',
    to: email,
    subject,
    html
  });
  console.log(`Verification email (${result}) sent to ${email}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// SCHEDULED FUNCTIONS — run daily via Cloud Scheduler
// ═════════════════════════════════════════════════════════════════════════════

const { onSchedule } = require('firebase-functions/v2/scheduler');

// ── Helper: days since a Firestore timestamp ──────────────────────────────────
function daysSince(firestoreTimestamp) {
  if (!firestoreTimestamp) return null;
  const ms = Date.now() - firestoreTimestamp.toDate().getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ID VERIFICATION REMINDERS (runs daily at 9am)
//    Day 3: gentle reminder | Day 7: final warning
// ─────────────────────────────────────────────────────────────────────────────
exports.checkIdReminders = onSchedule('every day 09:00', async () => {
  const snapshot = await db.collection('customers')
    .where('idStatus', '==', 'pending')
    .get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const days = daysSince(data.created);
    if (days === null) continue;

    const name = data.name || 'there';
    const email = data.email;

    if (days === 3) {
      await transporter.sendMail({
        from: '"Forward My Mail" <info@forwardmymail.co.uk>',
        to: email,
        subject: 'Reminder: Please complete your identity verification',
        html: buildIdReminderEmail(name, 3)
      });
      console.log(`ID day-3 reminder sent to ${email}`);
    } else if (days === 7) {
      await transporter.sendMail({
        from: '"Forward My Mail" <info@forwardmymail.co.uk>',
        to: email,
        subject: 'Final reminder: Identity verification required',
        html: buildIdFinalWarningEmail(name)
      });
      console.log(`ID day-7 final warning sent to ${email}`);
    }
  }
});

function buildIdReminderEmail(name) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:0}
    .wrapper{max-width:620px;margin:0 auto;background:white}
    .header{background:linear-gradient(135deg,#1e3a8a,#1e40af);padding:40px 30px;text-align:center;color:white}
    .header h1{font-size:24px;margin:10px 0 6px}
    .header p{color:rgba(255,255,255,.8);font-size:14px;margin:0}
    .content{padding:36px 30px}
    .warning-box{background:#fefce8;border:2px solid #fbbf24;border-radius:12px;padding:20px;margin:20px 0}
    .warning-box p{color:#78350f;font-size:15px;line-height:1.6;margin:0}
    .cta-btn{display:block;background:#d97706;color:white;text-decoration:none;text-align:center;padding:16px 30px;border-radius:10px;font-size:16px;font-weight:700;margin:24px 0}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 30px;text-align:center;font-size:12px;color:#94a3b8}
  </style></head><body><div class="wrapper">
    <div class="header"><h1>⏰ Reminder: Verify Your Identity</h1><p>Your account is waiting to be activated</p></div>
    <div class="content">
      <p style="font-size:16px;color:#334155">Hi <strong>${name}</strong>,</p>
      <p style="color:#475569;line-height:1.7">You signed up with Forward My Mail a few days ago — great to have you on board! We just wanted to remind you that your identity verification is still pending.</p>
      <div class="warning-box"><p>⚠️ <strong>Your account is currently locked</strong> until you complete a quick 2-minute identity check. It's simple — just your passport or driving licence and a quick selfie.</p></div>
      <a href="https://www.forwardmymail.co.uk/customer-portal.html#verify" class="cta-btn">Complete Verification Now →</a>
      <p style="color:#64748b;font-size:14px">Once verified, your UK business address will be fully active and ready to use.</p>
    </div>
    <div class="footer">Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6PS</div>
  </div></body></html>`;
}

function buildIdFinalWarningEmail(name) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:0}
    .wrapper{max-width:620px;margin:0 auto;background:white}
    .header{background:linear-gradient(135deg,#991b1b,#b91c1c);padding:40px 30px;text-align:center;color:white}
    .header h1{font-size:24px;margin:10px 0 6px}
    .header p{color:rgba(255,255,255,.8);font-size:14px;margin:0}
    .content{padding:36px 30px}
    .danger-box{background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:20px;margin:20px 0}
    .danger-box p{color:#7f1d1d;font-size:15px;line-height:1.6;margin:0}
    .cta-btn{display:block;background:#dc2626;color:white;text-decoration:none;text-align:center;padding:16px 30px;border-radius:10px;font-size:16px;font-weight:700;margin:24px 0}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 30px;text-align:center;font-size:12px;color:#94a3b8}
  </style></head><body><div class="wrapper">
    <div class="header"><h1>🚨 Final Reminder: Action Required</h1><p>Your account will remain locked without verification</p></div>
    <div class="content">
      <p style="font-size:16px;color:#334155">Hi <strong>${name}</strong>,</p>
      <p style="color:#475569;line-height:1.7">This is your final reminder that your Forward My Mail account is still awaiting identity verification.</p>
      <div class="danger-box"><p>🔒 <strong>Your account remains locked.</strong> Without completing verification, you won't be able to receive, view or manage any mail sent to your address. The process takes under 2 minutes.</p></div>
      <a href="https://www.forwardmymail.co.uk/customer-portal.html#verify" class="cta-btn">Verify My Identity Now →</a>
      <p style="color:#64748b;font-size:14px">Questions? Reply to this email or contact us at <a href="mailto:info@forwardmymail.co.uk">info@forwardmymail.co.uk</a></p>
    </div>
    <div class="footer">Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6PS</div>
  </div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOW CREDITS WARNING (runs daily at 9am)
//    Sends when balance drops to £5 or below (once per 7 days max)
// ─────────────────────────────────────────────────────────────────────────────
exports.checkLowCredits = onSchedule('every day 09:00', async () => {
  const snapshot = await db.collection('customers')
    .where('idStatus', '==', 'approved')
    .get();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const credits = data.credits || 0;
    if (credits > 5) continue;

    // Don't spam — only send if we haven't sent one in the last 7 days
    if (data.lowCreditEmailSent && data.lowCreditEmailSent.toDate() > sevenDaysAgo) continue;

    await transporter.sendMail({
      from: '"Forward My Mail" <info@forwardmymail.co.uk>',
      to: data.email,
      subject: '⚠️ Your Forward My Mail credits are running low',
      html: buildLowCreditsEmail(data.name || 'there', credits)
    });

    await doc.ref.update({ lowCreditEmailSent: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`Low credits warning sent to ${data.email} (balance: £${credits})`);
  }
});

function buildLowCreditsEmail(name, balance) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:0}
    .wrapper{max-width:620px;margin:0 auto;background:white}
    .header{background:linear-gradient(135deg,#1e3a8a,#1e40af);padding:40px 30px;text-align:center;color:white}
    .header h1{font-size:24px;margin:10px 0 6px}
    .content{padding:36px 30px}
    .balance-box{background:#fefce8;border:2px solid #fbbf24;border-radius:12px;padding:24px;margin:20px 0;text-align:center}
    .balance-box .amount{font-size:48px;font-weight:800;color:#92400e}
    .balance-box p{color:#78350f;margin:8px 0 0;font-size:14px}
    .cta-btn{display:block;background:#1e3a8a;color:white;text-decoration:none;text-align:center;padding:16px 30px;border-radius:10px;font-size:16px;font-weight:700;margin:24px 0}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 30px;text-align:center;font-size:12px;color:#94a3b8}
  </style></head><body><div class="wrapper">
    <div class="header"><h1>⚠️ Low Credits Warning</h1></div>
    <div class="content">
      <p style="font-size:16px;color:#334155">Hi <strong>${name}</strong>,</p>
      <p style="color:#475569;line-height:1.7">Your Forward My Mail credit balance is running low. Top up now to ensure we can continue handling your mail without interruption.</p>
      <div class="balance-box">
        <div class="amount">£${balance.toFixed(2)}</div>
        <p>Current credit balance</p>
      </div>
      <a href="https://www.forwardmymail.co.uk/customer-portal.html#credits" class="cta-btn">Top Up Credits →</a>
    </div>
    <div class="footer">Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6PS</div>
  </div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MAIL STORAGE WARNINGS + AUTO-SHRED WITH GOOGLE DRIVE ARCHIVE (runs daily 9am)
//    Day 25: storage warning
//    Day 55: shred warning (final)
//    Day 60: archive scan to Google Drive → then mark shredded
// ─────────────────────────────────────────────────────────────────────────────

// google already imported at top of file
// stream already required at top

async function getGoogleDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './serviceAccountKey.json',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return google.drive({ version: 'v3', auth });
}

async function archiveMailToDrive(mailItem, customerData) {
  const drive = await getGoogleDriveClient();

  // Find or create customer folder
  const customerFolderName = `${customerData.mailboxId || customerData.name} — ${customerData.name}`;
  let folderId;

  const folderSearch = await drive.files.list({
    q: `name='FMM Mail Archive' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  let rootFolderId;
  if (folderSearch.data.files.length > 0) {
    rootFolderId = folderSearch.data.files[0].id;
  } else {
    const rootFolder = await drive.files.create({
      resource: { name: 'FMM Mail Archive', mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    });
    rootFolderId = rootFolder.data.id;
  }

  const customerFolderSearch = await drive.files.list({
    q: `name='${customerFolderName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  if (customerFolderSearch.data.files.length > 0) {
    folderId = customerFolderSearch.data.files[0].id;
  } else {
    const customerFolder = await drive.files.create({
      resource: { name: customerFolderName, mimeType: 'application/vnd.google-apps.folder', parents: [rootFolderId] },
      fields: 'id',
    });
    folderId = customerFolder.data.id;
  }

  // Create archive record as a Google Doc
  const arrivedDate = mailItem.arrivedAt ? new Date(mailItem.arrivedAt.toDate()).toLocaleDateString('en-GB') : 'Unknown';
  const archiveContent = `FORWARD MY MAIL — AUTO-SHRED ARCHIVE RECORD
============================================
Customer: ${customerData.name}
Company: ${customerData.company || 'N/A'}
Mailbox ID: ${customerData.mailboxId || 'N/A'}
Email: ${customerData.email}

Mail Item: ${mailItem.id}
Description: ${mailItem.description || 'No description'}
Sender: ${mailItem.sender || 'Unknown'}
Arrived: ${arrivedDate}
Auto-shredded: ${new Date().toLocaleDateString('en-GB')}

This item was automatically shredded after 60 days of storage.
Archive created by Forward My Mail automated system.
If the customer urgently needs this document, please check
if a scan was taken before shredding.`;

  const bufferStream = new stream.PassThrough();
  bufferStream.end(Buffer.from(archiveContent, 'utf8'));

  const archiveFileName = `${arrivedDate.replace(/\//g, '-')} — ${mailItem.description || mailItem.id}`;

  await drive.files.create({
    resource: { name: archiveFileName, parents: [folderId] },
    media: { mimeType: 'text/plain', body: bufferStream },
    fields: 'id',
  });

  console.log(`Archived mail item ${mailItem.id} to Drive for ${customerData.email}`);
}

exports.checkMailStorage = onSchedule('every day 09:00', async () => {
  const customersSnapshot = await db.collection('customers').get();

  for (const customerDoc of customersSnapshot.docs) {
    const customerData = customerDoc.data();

    const mailSnapshot = await db.collection('customers')
      .doc(customerDoc.id)
      .collection('mail')
      .where('status', '==', 'stored')
      .get();

    for (const mailDoc of mailSnapshot.docs) {
      const mailData = { id: mailDoc.id, ...mailDoc.data() };
      const days = daysSince(mailData.arrivedAt);
      if (days === null) continue;

      if (days === 25) {
        // Storage warning
        await transporter.sendMail({
          from: '"Forward My Mail" <info@forwardmymail.co.uk>',
          to: customerData.email,
          subject: '📦 Mail storage reminder — 35 days remaining',
          html: buildStorageWarningEmail(customerData.name || 'there', mailData, days, 60 - days)
        });
        console.log(`Storage warning (day 25) sent to ${customerData.email} for mail ${mailDoc.id}`);

      } else if (days === 55) {
        // Final shred warning
        await transporter.sendMail({
          from: '"Forward My Mail" <info@forwardmymail.co.uk>',
          to: customerData.email,
          subject: '🚨 Final notice: Mail will be shredded in 5 days',
          html: buildShredWarningEmail(customerData.name || 'there', mailData)
        });
        console.log(`Shred warning (day 55) sent to ${customerData.email} for mail ${mailDoc.id}`);

      } else if (days >= 60) {
        // Auto-shred: archive to Drive first, then mark shredded
        try {
          await archiveMailToDrive(mailData, customerData);
        } catch (archiveErr) {
          console.error(`Drive archive failed for ${mailDoc.id}:`, archiveErr);
          // Continue with shred even if archive fails — log it for manual recovery
          await db.collection('shredArchiveErrors').add({
            customerId: customerDoc.id,
            customerEmail: customerData.email,
            mailId: mailDoc.id,
            error: archiveErr.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        await mailDoc.ref.update({
          status: 'shredded',
          shreddedAt: admin.firestore.FieldValue.serverTimestamp(),
          shredReason: 'auto-60-days',
          driveArchived: true
        });

        await transporter.sendMail({
          from: '"Forward My Mail" <info@forwardmymail.co.uk>',
          to: customerData.email,
          subject: '🗑️ Mail item has been shredded',
          html: buildAutoShredEmail(customerData.name || 'there', mailData)
        });

        console.log(`Auto-shredded mail ${mailDoc.id} for ${customerData.email} after ${days} days`);
      }
    }
  }
});

function buildStorageWarningEmail(name, mailItem, daysStored, daysRemaining) {
  const arrivedDate = mailItem.arrivedAt ? new Date(mailItem.arrivedAt.toDate()).toLocaleDateString('en-GB') : 'Unknown';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:0}
    .wrapper{max-width:620px;margin:0 auto;background:white}
    .header{background:linear-gradient(135deg,#1e3a8a,#1e40af);padding:40px 30px;text-align:center;color:white}
    .header h1{font-size:24px;margin:10px 0 6px}
    .content{padding:36px 30px}
    .mail-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0}
    .mail-card p{margin:4px 0;color:#334155;font-size:14px}
    .warning-box{background:#fefce8;border:2px solid #fbbf24;border-radius:12px;padding:20px;margin:20px 0}
    .warning-box p{color:#78350f;font-size:15px;line-height:1.6;margin:0}
    .cta-btn{display:block;background:#1e3a8a;color:white;text-decoration:none;text-align:center;padding:16px 30px;border-radius:10px;font-size:16px;font-weight:700;margin:24px 0}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 30px;text-align:center;font-size:12px;color:#94a3b8}
  </style></head><body><div class="wrapper">
    <div class="header"><h1>📦 Mail Storage Reminder</h1><p>Action needed within ${daysRemaining} days</p></div>
    <div class="content">
      <p style="font-size:16px;color:#334155">Hi <strong>${name}</strong>,</p>
      <p style="color:#475569;line-height:1.7">A mail item at your address has been stored for ${daysStored} days. We hold items for 60 days before shredding — please log in and choose what to do with it.</p>
      <div class="mail-card">
        <p><strong>Description:</strong> ${mailItem.description || 'Mail item'}</p>
        <p><strong>From:</strong> ${mailItem.sender || 'Unknown sender'}</p>
        <p><strong>Arrived:</strong> ${arrivedDate}</p>
        <p><strong>Days remaining:</strong> ${daysRemaining} days</p>
      </div>
      <div class="warning-box"><p>⏰ This item will be <strong>permanently shredded in ${daysRemaining} days</strong> if no action is taken. Log in to scan, forward or keep it.</p></div>
      <a href="https://www.forwardmymail.co.uk/customer-portal.html" class="cta-btn">Manage My Mail →</a>
    </div>
    <div class="footer">Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6PS</div>
  </div></body></html>`;
}

function buildShredWarningEmail(name, mailItem) {
  const arrivedDate = mailItem.arrivedAt ? new Date(mailItem.arrivedAt.toDate()).toLocaleDateString('en-GB') : 'Unknown';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:0}
    .wrapper{max-width:620px;margin:0 auto;background:white}
    .header{background:linear-gradient(135deg,#991b1b,#b91c1c);padding:40px 30px;text-align:center;color:white}
    .header h1{font-size:24px;margin:10px 0 6px}
    .content{padding:36px 30px}
    .mail-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0}
    .mail-card p{margin:4px 0;color:#334155;font-size:14px}
    .danger-box{background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:20px;margin:20px 0}
    .danger-box p{color:#7f1d1d;font-size:15px;line-height:1.6;margin:0}
    .cta-btn{display:block;background:#dc2626;color:white;text-decoration:none;text-align:center;padding:16px 30px;border-radius:10px;font-size:16px;font-weight:700;margin:24px 0}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 30px;text-align:center;font-size:12px;color:#94a3b8}
  </style></head><body><div class="wrapper">
    <div class="header"><h1>🚨 Final Notice: Shredding in 5 Days</h1></div>
    <div class="content">
      <p style="font-size:16px;color:#334155">Hi <strong>${name}</strong>,</p>
      <p style="color:#475569;line-height:1.7">This is your final notice. A mail item stored at your address will be <strong>permanently shredded in 5 days</strong>.</p>
      <div class="mail-card">
        <p><strong>Description:</strong> ${mailItem.description || 'Mail item'}</p>
        <p><strong>From:</strong> ${mailItem.sender || 'Unknown sender'}</p>
        <p><strong>Arrived:</strong> ${arrivedDate}</p>
      </div>
      <div class="danger-box"><p>🚨 <strong>Last chance</strong> — after 60 days from arrival this item will be shredded and cannot be recovered. Log in now to scan, forward or request we keep it longer.</p></div>
      <a href="https://www.forwardmymail.co.uk/customer-portal.html" class="cta-btn">Take Action Now →</a>
    </div>
    <div class="footer">Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6PS</div>
  </div></body></html>`;
}

function buildAutoShredEmail(name, mailItem) {
  const arrivedDate = mailItem.arrivedAt ? new Date(mailItem.arrivedAt.toDate()).toLocaleDateString('en-GB') : 'Unknown';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:0}
    .wrapper{max-width:620px;margin:0 auto;background:white}
    .header{background:linear-gradient(135deg,#374151,#4b5563);padding:40px 30px;text-align:center;color:white}
    .header h1{font-size:24px;margin:10px 0 6px}
    .content{padding:36px 30px}
    .mail-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0}
    .mail-card p{margin:4px 0;color:#334155;font-size:14px}
    .archive-box{background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:20px;margin:20px 0}
    .archive-box p{color:#14532d;font-size:14px;line-height:1.6;margin:0}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 30px;text-align:center;font-size:12px;color:#94a3b8}
  </style></head><body><div class="wrapper">
    <div class="header"><h1>🗑️ Mail Item Shredded</h1><p>60-day storage period expired</p></div>
    <div class="content">
      <p style="font-size:16px;color:#334155">Hi <strong>${name}</strong>,</p>
      <p style="color:#475569;line-height:1.7">The following mail item has been securely shredded as it reached our 60-day storage limit.</p>
      <div class="mail-card">
        <p><strong>Description:</strong> ${mailItem.description || 'Mail item'}</p>
        <p><strong>From:</strong> ${mailItem.sender || 'Unknown sender'}</p>
        <p><strong>Arrived:</strong> ${arrivedDate}</p>
        <p><strong>Shredded:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
      </div>
      <div class="archive-box"><p>✅ <strong>We've kept an archive record</strong> of this item. If you urgently need information about it, please contact us at <a href="mailto:info@forwardmymail.co.uk" style="color:#15803d">info@forwardmymail.co.uk</a> and we'll do our best to help.</p></div>
    </div>
    <div class="footer">Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6PS</div>
  </div></body></html>`;
}
