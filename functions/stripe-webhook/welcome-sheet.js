// Welcome fact sheet PDF — generated server-side, delivered as the customer's
// first free scan. Layout mirrors the FMM Modern Minimalist fact sheet design.
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const INK = rgb(0.149, 0.188, 0.227);      // #26303a
const CHARCOAL = rgb(0.212, 0.271, 0.310); // #36454f
const DIM = rgb(0.412, 0.451, 0.498);      // #69737f
const SOFT = rgb(0.957, 0.961, 0.965);     // #f4f5f6
const LINE = rgb(0.867, 0.878, 0.894);     // #dde0e4
const WHITE = rgb(1, 1, 1);
const MUTED_W = rgb(0.682, 0.725, 0.761);  // light text on dark
const GREEN = rgb(0.247, 0.478, 0.341);    // #3f7a57

const PACKAGES = {
  'Personal Mailbox': {
    short: 'Personal mail',
    long: 'We receive personal mail addressed to you. Company or official mail needs a business package — upgrade any time in the portal.',
  },
  'Business Address': {
    short: 'Personal + company',
    long: 'We receive personal mail and mail addressed to your company at your business address.',
  },
  'Registered Office': {
    short: 'Official + personal',
    long: 'We receive official government mail (HMRC, Companies House) for your company as your registered office, plus personal mail. Non-government items can be scanned using credits.',
  },
  'Full Virtual Office': {
    short: 'Official + personal',
    long: 'We receive official government mail (HMRC, Companies House) and personal mail as your full virtual office. Non-government items can be scanned using credits.',
  },
};

function wrap(text, font, size, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (font.widthOfTextAtSize(t, size) <= maxWidth) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

async function buildWelcomeSheetPdf({ name, company, email, mailboxId, package: pkgName }) {
  const pkg = PACKAGES[pkgName] || PACKAGES['Personal Mailbox'];
  const who = name + (company ? ' / ' + company : '');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4 pt
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 42; // side margin
  const W = 595 - M * 2;
  let y;

  const text = (s, x, yy, size, font, color) => page.drawText(s, { x, y: yy, size, font, color });
  const box = (x, yy, w, h, color, border) => page.drawRectangle({ x, y: yy, width: w, height: h, color, borderColor: border, borderWidth: border ? 0.5 : 0 });

  // ── header ──
  box(0, 842 - 118, 595, 118, INK);
  text('Welcome to Forward My Mail', M, 842 - 40, 19, bold, WHITE);
  text('Your mailbox is ready. This fact sheet has everything you need to get started.', M, 842 - 58, 9.5, reg, MUTED_W);
  text('P R E P A R E D   F O R', M, 842 - 80, 7.5, bold, MUTED_W);
  text(who, M, 842 - 96, 13, bold, WHITE);

  // ── address card ──
  y = 842 - 136;
  const cardH = 118;
  box(M, y - cardH, W, cardH, CHARCOAL);
  text('T H I S   I S   Y O U R   N E W   P O S T A L   A D D R E S S', M + 18, y - 18, 7.5, bold, MUTED_W);
  text(who, M + 18, y - 36, 11, bold, WHITE);
  text('Box ' + mailboxId, M + 18, y - 51, 11, bold, WHITE);
  text('8a Bore Street, Lichfield, Staffordshire, WS13 6LL, United Kingdom', M + 18, y - 67, 10, reg, rgb(0.87, 0.89, 0.91));
  text('Include your box number so we can match mail to you instantly.', M + 18, y - 100, 8.5, reg, MUTED_W);

  // ── at-a-glance grid ──
  y = y - cardH - 14;
  const cellW = W / 4, cellH = 36;
  const cells = [['MAILBOX ID', mailboxId], ['PACKAGE', pkgName], ['MAIL WE ACCEPT', pkg.short], ['ACCOUNT EMAIL', email]];
  cells.forEach((c, i) => {
    const x = M + i * cellW;
    box(x, y - cellH, cellW, cellH, SOFT, LINE);
    text(c[0], x + 8, y - 13, 6.5, bold, DIM);
    const vs = c[0] === 'ACCOUNT EMAIL' ? 8 : 9.5;
    text(c[1], x + 8, y - 27, vs, bold, INK);
  });

  // ── package box ──
  y = y - cellH - 14;
  const pkgLines = wrap(pkg.long, reg, 9.5, W - 28);
  const pkgH = 26 + pkgLines.length * 12;
  box(M, y - pkgH, W, pkgH, SOFT, LINE);
  text('YOUR ' + pkgName.toUpperCase() + ' PACKAGE', M + 14, y - 15, 8, bold, DIM);
  pkgLines.forEach((l, i) => text(l, M + 14, y - 30 - i * 12, 9.5, reg, INK));

  // ── how it works ──
  y = y - pkgH - 24;
  text('How it works', M, y, 12.5, bold, INK);
  y -= 18;
  const steps = [
    ['Your mail arrives with us.', 'We receive it securely at 8a Bore Street and log it against Box ' + mailboxId + ' the same day.'],
    ['You get an email alert.', 'Every new item triggers a notification to ' + email + ' — nothing arrives without you knowing.'],
    ['Read it in your portal.', 'We scan the contents on request and they appear in your secure portal — exactly like this fact sheet did.'],
    ['You decide what happens next.', 'Forward the original on, hold it for collection, or have it securely shredded — one click in the portal.'],
  ];
  steps.forEach((s, i) => {
    page.drawEllipse({ x: M + 8, y: y - 2, xScale: 8, yScale: 8, color: CHARCOAL });
    text(String(i + 1), M + 5.5, y - 5.5, 9, bold, WHITE);
    text(s[0], M + 24, y - 2, 10, bold, INK);
    const sub = wrap(s[1], reg, 9, W - 24);
    sub.forEach((l, j) => text(l, M + 24, y - 15 - j * 11, 9, reg, DIM));
    y -= 22 + sub.length * 11;
  });

  // ── pricing ──
  const priceTxt = 'First page £0.50 · each additional page £0.25, charged from your credit balance. Top up any time in the portal.';
  const prLines = wrap(priceTxt, reg, 9.5, W - 28);
  const prH = 30 + prLines.length * 12 + 14;
  box(M, y - prH, W, prH, SOFT, LINE);
  text('SCAN PRICING', M + 14, y - 15, 8, bold, DIM);
  prLines.forEach((l, i) => text(l, M + 14, y - 30 - i * 12, 9.5, reg, INK));
  text('This fact sheet was delivered as a free scan — no charge, and now you know how scans arrive.', M + 14, y - 30 - prLines.length * 12 - 6, 9, bold, GREEN);

  // ── footer ──
  box(0, 0, 595, 52, SOFT, LINE);
  text('Forward My Mail Ltd · 8a Bore Street, Lichfield, Staffordshire, WS13 6LL · Company No. 16912540', M, 32, 8.5, bold, DIM);
  text('Questions? info@forwardmymail.co.uk · Portal: www.forwardmymail.co.uk/customer-portal.html', M, 18, 8.5, reg, DIM);

  return Buffer.from(await doc.save());
}

module.exports = { buildWelcomeSheetPdf };
