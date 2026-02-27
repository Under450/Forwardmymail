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

async function sendWelcomeEmail(email, name, mailboxId) {
  const mailOptions = {
    from: '"Forward My Mail" <info@forwardmymail.co.uk>',
    to: email,
    subject: 'Welcome to Forward My Mail - Your Account Details',
    html: `<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1e3c72 0%,#2a5298 100%);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}.mailbox-id{background:#fff;border:2px solid #1e3c72;border-radius:8px;padding:20px;margin:20px 0;text-align:center}.mailbox-id h2{color:#1e3c72;margin:0;font-size:32px}.address-box{background:#fff;padding:20px;border-left:4px solid #1e3c72;margin:20px 0}.button{display:inline-block;background:#1e3c72;color:white;padding:15px 30px;text-decoration:none;border-radius:8px;margin:20px 0}.footer{text-align:center;color:#666;font-size:12px;margin-top:30px}</style></head><body><div class="container"><div class="header"><h1>Welcome to Forward My Mail!</h1><p>Your virtual mailbox is ready</p></div><div class="content"><p>Hi ${name},</p><p>Thank you for your purchase! Your Forward My Mail account is now active.</p><div class="mailbox-id"><p style="margin:0;color:#666">Your Mailbox ID</p><h2>${mailboxId}</h2></div><h3>Your Mailbox Address</h3><div class="address-box"><strong>${name}</strong><br>${mailboxId}<br>8a Bore Street<br>Lichfield, Staffordshire<br>WS13 6PS<br>United Kingdom</div><p><strong>Use this address for:</strong></p><ul><li>Personal mail and packages</li><li>Business correspondence</li><li>Online shopping deliveries</li></ul><h3>Access Your Account</h3><p>Login to manage your mail:</p><a href="https://forwardmymail.co.uk/customer-portal.html" class="button">Access Your Portal</a><p>Need help? Reply to this email or contact us at info@forwardmymail.co.uk</p><p>Best regards,<br><strong>The Forward My Mail Team</strong></p><div class="footer"><p>Forward My Mail Ltd | 8a Bore Street, Lichfield, WS13 6PS | Company No. 16912540</p></div></div></div></body></html>`
  };

  try {
    await transporter.sendMail(mailOptions);
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
      const customerEmail = session.customer_email || session.metadata?.customerEmail;

      if (!amount && session.amount_total) {
        amount = session.amount_total / 100;
      }

      if (!amount || !customerEmail) {
        console.error('Missing required data in session:', session);
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
        await sendWelcomeEmail(
          finalCustomerData.email,
          finalCustomerData.name,
          finalCustomerData.mailboxId || 'Being assigned'
        );
        console.log(`Confirmation email sent to ${finalCustomerData.email}`);
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
