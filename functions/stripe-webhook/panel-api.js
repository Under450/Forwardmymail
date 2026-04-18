const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const PANEL_UID = 'pY80AVfY9teBlcBD8b8EUo3rORm2';

function assertPanelAuth(request) {
  if (request.auth?.uid !== PANEL_UID) {
    throw new HttpsError('permission-denied', 'Not authorised');
  }
}

const db = admin.firestore();

// ── panelGetStripeBalance ────────────────────────────────────────────────────
exports.panelGetStripeBalance = onCall(async (request) => {
  assertPanelAuth(request);

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const balance = await stripe.balance.retrieve();

  const available = (balance.available || [])
    .filter(b => b.currency === 'gbp')
    .reduce((sum, b) => sum + b.amount, 0) / 100;

  const pending = (balance.pending || [])
    .filter(b => b.currency === 'gbp')
    .reduce((sum, b) => sum + b.amount, 0) / 100;

  // Get today's transactions for delta
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let todayDelta = 0;
  try {
    const txns = await stripe.balanceTransactions.list({
      created: { gte: Math.floor(todayStart.getTime() / 1000) },
      limit: 100,
    });
    todayDelta = txns.data.reduce((sum, t) => sum + t.net, 0) / 100;
  } catch (e) {
    console.error('Failed to get today delta:', e.message);
  }

  // Get 30-day balance history (daily available balance from transactions)
  let history = [];
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const txns = await stripe.balanceTransactions.list({
      created: { gte: Math.floor(thirtyDaysAgo.getTime() / 1000) },
      limit: 100,
    });

    // Group by date
    const dailyTotals = {};
    for (const t of txns.data) {
      const d = new Date(t.created * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      dailyTotals[d] = (dailyTotals[d] || 0) + t.net / 100;
    }

    // Build cumulative history
    let runningTotal = available;
    const dates = Object.keys(dailyTotals).reverse();
    history = dates.map(d => {
      runningTotal -= dailyTotals[d];
      return { date: d, balance: Math.round(runningTotal) };
    }).reverse();
    // Add today
    history.push({ date: 'Today', balance: Math.round(available) });
  } catch (e) {
    console.error('Failed to get balance history:', e.message);
  }

  return { available, pending, todayDelta, history };
});

// ── panelGetStripeEvents ─────────────────────────────────────────────────────
exports.panelGetStripeEvents = onCall(async (request) => {
  assertPanelAuth(request);

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const eventsResult = await stripe.events.list({ limit: 20 });

  // Get lastViewed
  const stateDoc = await db.doc('panel_state/stripe_events').get();
  const lastViewed = stateDoc.exists ? stateDoc.data().lastViewed?.toDate() : null;

  const events = eventsResult.data.map(e => {
    const obj = e.data?.object || {};
    return {
      type: e.type,
      created: new Date(e.created * 1000).toISOString(),
      amount: obj.amount ? obj.amount / 100 : null,
      description: obj.description || obj.customer_email || '',
    };
  });

  const unreadCount = lastViewed
    ? events.filter(e => new Date(e.created) > lastViewed).length
    : events.length;

  return {
    events,
    unreadCount,
    lastViewed: lastViewed ? lastViewed.toISOString() : null,
  };
});

// ── panelGetRecentSignups ────────────────────────────────────────────────────
exports.panelGetRecentSignups = onCall(async (request) => {
  assertPanelAuth(request);

  const snapshot = await db.collection('customers')
    .orderBy('created', 'desc')
    .limit(50)
    .get();

  const stateDoc = await db.doc('panel_state/signups').get();
  const lastViewed = stateDoc.exists ? stateDoc.data().lastViewed?.toDate() : null;

  const customers = snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      name: d.name || '',
      email: d.email || '',
      tier: d.package || '',
      createdAt: d.created?.toDate()?.toISOString() || null,
    };
  });

  const newCount = lastViewed
    ? customers.filter(c => c.createdAt && new Date(c.createdAt) > lastViewed).length
    : customers.length;

  return {
    customers,
    newCount,
    lastViewed: lastViewed ? lastViewed.toISOString() : null,
  };
});

// ── panelGetAllCustomers ─────────────────────────────────────────────────────
exports.panelGetAllCustomers = onCall(async (request) => {
  assertPanelAuth(request);

  const snapshot = await db.collection('customers').get();

  const customers = snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      name: d.name || '',
      email: d.email || '',
      tier: d.package || '',
      idStatus: d.idStatus || 'unknown',
      createdAt: d.created?.toDate()?.toISOString() || null,
    };
  });

  return { customers };
});

// ── panelGetDiditQueue ───────────────────────────────────────────────────────
exports.panelGetDiditQueue = onCall(async (request) => {
  assertPanelAuth(request);

  const snapshot = await db.collection('customers')
    .where('idStatus', '==', 'pending')
    .get();

  const customers = snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      name: d.name || '',
      email: d.email || '',
      createdAt: d.created?.toDate()?.toISOString() || null,
    };
  });

  return { customers, pendingCount: customers.length };
});

// ── panelGetInbox ────────────────────────────────────────────────────────────
// Gmail API not configured — returns notConfigured state
exports.panelGetInbox = onCall(async (request) => {
  assertPanelAuth(request);
  return { messages: [], unread: 0, notConfigured: true };
});

// ── panelMarkViewed ──────────────────────────────────────────────────────────
exports.panelMarkViewed = onCall(async (request) => {
  assertPanelAuth(request);

  const key = request.data?.key;
  const validKeys = ['stripe_events', 'signups', 'inbox', 'didit'];
  if (!validKeys.includes(key)) {
    throw new HttpsError('invalid-argument', 'Invalid key');
  }

  await db.doc(`panel_state/${key}`).set(
    { lastViewed: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { success: true };
});
