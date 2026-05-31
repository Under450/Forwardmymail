// ─────────────────────────────────────────────────────────────────────────────
// Telegram notifier — Forward My Mail
// Sends a push to Craig's iPhone (via Telegram bot) whenever a new paying
// customer signs up, or a new account is created. Idempotent per source event.
//
// Secrets (set as env vars in Google Cloud Run — see SECRETS.md):
//   TELEGRAM_BOT_TOKEN  — bot token from @BotFather (e.g. 1234567:ABC...)
//   TELEGRAM_CHAT_ID    — your personal chat ID (e.g. 987654321)
//
// Idempotency: writes a notifications/{key} doc using .create() (atomic).
// If the doc already exists, the send is skipped. This prevents duplicate
// Telegram messages when Stripe retries a webhook or Firestore re-fires a trigger.
// ─────────────────────────────────────────────────────────────────────────────

const admin = require('firebase-admin');

const TELEGRAM_API = 'https://api.telegram.org';

// Escape HTML special chars for Telegram parse_mode=HTML.
// Telegram requires &, <, > escaped inside message text.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Format a Date as "31 May 2026, 14:32 BST" in Europe/London.
function formatLondonTime(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch (e) {
    return new Date().toISOString();
  }
}

// Format a GBP amount as "£299.00". Returns "—" if amount is null/undefined.
function formatAmount(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  return `£${Number(amount).toFixed(2)}`;
}

// Build the message body for a paid-customer notification.
function buildPaidMessage({ name, email, packageType, amount, date }) {
  return [
    '🔔 <b>New FMM Customer (Paid)</b>',
    `<b>Name:</b> ${escapeHtml(name || '—')}`,
    `<b>Email:</b> ${escapeHtml(email || '—')}`,
    `<b>Package:</b> ${escapeHtml(packageType || '—')}`,
    `<b>Amount:</b> ${escapeHtml(formatAmount(amount))}`,
    `<b>Time:</b> ${escapeHtml(formatLondonTime(date))}`,
  ].join('\n');
}

// Build the message body for a free-signup notification.
function buildSignupMessage({ name, email, company, mailboxId, date }) {
  return [
    '👤 <b>New FMM Signup (No Payment Yet)</b>',
    `<b>Name:</b> ${escapeHtml(name || '—')}`,
    `<b>Email:</b> ${escapeHtml(email || '—')}`,
    `<b>Company:</b> ${escapeHtml(company || '—')}`,
    `<b>Mailbox ID:</b> ${escapeHtml(mailboxId || 'Pending')}`,
    `<b>Time:</b> ${escapeHtml(formatLondonTime(date))}`,
  ].join('\n');
}

// Core HTTP call to Telegram. Uses Node 22 native fetch (no npm deps).
async function sendToTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping send');
    return { ok: false, skipped: true, reason: 'secrets_missing' };
  }

  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  // 10s timeout — Telegram is usually <1s. Don't hang the webhook.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      console.error('[telegram] sendMessage failed:', res.status, json);
      return { ok: false, status: res.status, body: json };
    }
    return { ok: true, messageId: json.result?.message_id };
  } catch (err) {
    clearTimeout(timeout);
    console.error('[telegram] sendMessage error:', err.message);
    return { ok: false, error: err.message };
  }
}

// Idempotency guard. Returns true if we should proceed with sending.
// Uses Firestore .create() which fails if the doc already exists — atomic.
async function claimNotification(key, meta = {}) {
  const db = admin.firestore();
  const ref = db.collection('notifications').doc(key);
  try {
    await ref.create({
      key,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...meta,
    });
    return true; // we won the race — proceed
  } catch (err) {
    // ALREADY_EXISTS (gRPC code 6) — another invocation already sent this.
    if (err.code === 6 || /already exists/i.test(err.message || '')) {
      console.log(`[telegram] notification already sent for key=${key} — skipping`);
      return false;
    }
    // Some other Firestore error — log but DO NOT block the send.
    // Better to risk a rare duplicate than miss a real notification.
    console.error('[telegram] claimNotification error (proceeding anyway):', err);
    return true;
  }
}

// Public: notify on a paid checkout.session.completed event.
// `sessionId` must be the Stripe session.id — used as idempotency key.
async function notifyPaidCustomer({ sessionId, name, email, packageType, amount, date }) {
  if (!sessionId) {
    console.error('[telegram] notifyPaidCustomer called without sessionId — skipping');
    return { ok: false, skipped: true, reason: 'no_session_id' };
  }
  const key = `stripe_${sessionId}`;
  const proceed = await claimNotification(key, {
    type: 'paid_customer',
    sessionId,
    email: email || '',
    packageType: packageType || '',
    amount: amount ?? null,
  });
  if (!proceed) return { ok: true, skipped: true, reason: 'duplicate' };

  const text = buildPaidMessage({ name, email, packageType, amount, date: date || new Date() });
  return sendToTelegram(text);
}

// Public: notify on a new customers/{id} doc creation (free signup).
async function notifyNewSignup({ customerId, name, email, company, mailboxId, date }) {
  if (!customerId) {
    console.error('[telegram] notifyNewSignup called without customerId — skipping');
    return { ok: false, skipped: true, reason: 'no_customer_id' };
  }
  const key = `signup_${customerId}`;
  const proceed = await claimNotification(key, {
    type: 'new_signup',
    customerId,
    email: email || '',
  });
  if (!proceed) return { ok: true, skipped: true, reason: 'duplicate' };

  const text = buildSignupMessage({ name, email, company, mailboxId, date: date || new Date() });
  return sendToTelegram(text);
}

module.exports = {
  notifyPaidCustomer,
  notifyNewSignup,
  // exported for testing
  _internal: { escapeHtml, formatLondonTime, formatAmount, buildPaidMessage, buildSignupMessage },
};
