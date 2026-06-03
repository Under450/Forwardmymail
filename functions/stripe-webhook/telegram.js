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
// Priority levels:
//   'urgent' — explicit disable_notification:false. Use for Didit errors,
//              ID declined, anything Craig must see immediately.
//   'normal' — default Telegram sound notification. ID approved, new paid customer.
//   'silent' — disable_notification:true. Delivered but no sound. Use for
//              low-priority signal Craig can check later (free signups,
//              test-bypass redemptions).
//
// Telegram CANNOT override a chat-level mute the user set in their client.
// If notifications are not arriving despite priority:'urgent', check the
// bot chat is not muted in the Telegram app (tap chat → bell icon).
async function sendToTelegram(text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping send');
    return { ok: false, skipped: true, reason: 'secrets_missing' };
  }

  const priority = options.priority || 'normal';
  const disableNotification = priority === 'silent';

  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    disable_notification: disableNotification,
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
  // Paid customer = real money landed. Ring the phone (normal priority).
  return sendToTelegram(text, { priority: 'normal' });
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
  // Free signup is informational; don't ring the phone.
  return sendToTelegram(text, { priority: 'silent' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Didit error notifier — alerts Craig when Didit KYC sessions fail
// (esp. when credits run out — visible to customers as "errors out").
//
// Throttle: notifications/didit-error-{kind}-{yyyymmddhh} doc — at most one
// alert per hour per error kind. Prevents Telegram spam if 50 customers all
// hit the same wall.
// ─────────────────────────────────────────────────────────────────────────────

function classifyDiditError(statusCode, errText) {
  const s = String(errText || '').toLowerCase();
  if (s.includes('credit') || s.includes('top up') || s.includes('balance')) return 'credits_exhausted';
  if (statusCode === 401 || statusCode === 403 || s.includes('api key') || s.includes('unauthor')) return 'auth_failed';
  if (statusCode === 429 || s.includes('rate') || s.includes('throttle')) return 'rate_limited';
  if (s.includes('workflow')) return 'workflow_invalid';
  if (statusCode >= 500) return 'didit_5xx';
  return 'unknown';
}

function buildDiditErrorMessage({ kind, customerEmail, customerId, statusCode, errText }) {
  const headings = {
    credits_exhausted: 'ALERT: <b>Didit OUT OF CREDITS</b>',
    auth_failed:       'ALERT: <b>Didit API key invalid</b>',
    rate_limited:      'WARN: <b>Didit rate-limited</b>',
    workflow_invalid:  'WARN: <b>Didit workflow_id invalid</b>',
    didit_5xx:         'WARN: <b>Didit upstream 5xx</b>',
    unknown:           'WARN: <b>Didit session failed</b>',
  };
  const actions = {
    credits_exhausted: 'Top up at https://business.didit.me — customers cannot verify ID until you do.',
    auth_failed:       'Rotate DIDIT_API_KEY env var. Check Didit dashboard then API.',
    rate_limited:      'Will recover automatically. If persistent, raise plan.',
    workflow_invalid:  'Check DIDIT_WORKFLOW_ID in index.js. Did you change workflow in Didit dashboard?',
    didit_5xx:         'Didit-side outage. Check status.didit.me or wait.',
    unknown:           'Check Cloud Function logs for full error.',
  };
  return [
    headings[kind] || headings.unknown,
    `<b>Customer hit:</b> ${escapeHtml(customerEmail || customerId || 'unknown')}`,
    `<b>Status:</b> ${statusCode || 'n/a'}`,
    `<b>Didit said:</b> ${escapeHtml(String(errText || '').slice(0, 200))}`,
    `<b>Time:</b> ${escapeHtml(formatLondonTime(new Date()))}`,
    '',
    `<b>Action:</b> ${actions[kind] || actions.unknown}`,
  ].join('\n');
}

// Public: notify on a Didit createSession failure.
// Throttled to once per hour per (kind) — avoids spam during outages.
async function notifyDiditError({ customerEmail, customerId, statusCode, errText }) {
  const kind = classifyDiditError(statusCode, errText);
  const hourKey = new Date().toISOString().slice(0, 13).replace(/[^0-9]/g, ''); // YYYYMMDDHH
  const idempotencyKey = `didit-error-${kind}-${hourKey}`;

  const shouldSend = await claimNotification(idempotencyKey, {
    kind, customerEmail, customerId, statusCode,
    errText: String(errText || '').slice(0, 500),
  });
  if (!shouldSend) {
    return { ok: true, skipped: true, reason: 'already-alerted-this-hour' };
  }

  const text = buildDiditErrorMessage({ kind, customerEmail, customerId, statusCode, errText });
  // Didit failures block customers from signing up — urgent.
  const result = await sendToTelegram(text, { priority: 'urgent' });
  return { ...result, kind };
}

// ─────────────────────────────────────────────────────────────────────────────
// ID verification result notifier — Telegram ping when Didit reports approved,
// declined, or pending. Idempotent per (customerId + status) — no duplicates if
// Didit re-delivers the same webhook.
// ─────────────────────────────────────────────────────────────────────────────

function buildIdResultMessage({ status, name, email, company, package: pkg, mailboxId, customerId }) {
  const headings = {
    approved: 'OK: <b>ID Verification APPROVED</b>',
    declined: 'WARN: <b>ID Verification DECLINED</b>',
    pending:  'INFO: <b>ID Verification in review</b>',
  };
  const heading = headings[status] || `INFO: <b>ID Verification: ${status}</b>`;
  const lines = [
    heading,
    `<b>Name:</b> ${escapeHtml(name || '—')}`,
    `<b>Email:</b> ${escapeHtml(email || '—')}`,
  ];
  if (company) lines.push(`<b>Company:</b> ${escapeHtml(company)}`);
  if (pkg)     lines.push(`<b>Package:</b> ${escapeHtml(pkg)}`);
  if (mailboxId) lines.push(`<b>Mailbox:</b> ${escapeHtml(mailboxId)}`);
  lines.push(`<b>Time:</b> ${escapeHtml(formatLondonTime(new Date()))}`);

  if (status === 'approved') {
    lines.push('');
    lines.push('<b>Next step:</b> Activate the mailbox in the staff portal so the customer can use it.');
  } else if (status === 'declined') {
    lines.push('');
    lines.push('<b>Next step:</b> Review the Didit result in the staff portal. Customer may need to retry.');
  }
  return lines.join('\n');
}

async function notifyIdVerified({ customerId, status, name, email, company, package: pkg, mailboxId, eventId }) {
  // Idempotency: one ping per (customerId + status) per eventId.
  // Using eventId means a Didit retry with the same event_id won't double-send.
  const key = `didit-result-${customerId}-${status}-${eventId || 'noev'}`;
  const shouldSend = await claimNotification(key, {
    customerId, status, email, eventId: eventId || null,
  });
  if (!shouldSend) {
    return { ok: true, skipped: true, reason: 'already-sent' };
  }
  const text = buildIdResultMessage({ status, name, email, company, package: pkg, mailboxId, customerId });
  // Declined needs attention; approved is good news but routine.
  const priority = status === 'declined' ? 'urgent' : 'normal';
  return sendToTelegram(text, { priority });
}

module.exports = {
  notifyPaidCustomer,
  notifyNewSignup,
  notifyDiditError,
  notifyIdVerified,
  classifyDiditError,
  // exported for testing
  _internal: { escapeHtml, formatLondonTime, formatAmount, buildPaidMessage, buildSignupMessage, buildDiditErrorMessage, buildIdResultMessage },
};
