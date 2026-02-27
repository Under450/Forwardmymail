# Secrets Setup — Forward My Mail Functions

The `index.js` file reads three secrets from environment variables at runtime.
They are **never** stored in code or committed to this repo.

---

## The three secrets

| Variable | What it is |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe live secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `EMAIL_PASS` | IONOS SMTP password for info@forwardmymail.co.uk |

---

## How to set them in Google Cloud

You only need to do this if you are redeploying the functions from scratch.
The currently deployed functions already have these set.

### Step 1 — Open Cloud Run in Google Cloud Console

1. Go to https://console.cloud.google.com
2. Select the **forward-my-mail** project
3. In the left menu go to **Cloud Run**

### Step 2 — Set environment variables on each function

You need to set the variables on both functions: **createCheckoutSession** and **stripeWebhook**.

For each function:
1. Click the function name
2. Click **Edit & Deploy New Revision** (top right)
3. Scroll down to **Variables & Secrets** → **Environment variables**
4. Add each variable:
   - Name: `STRIPE_SECRET_KEY` → Value: the `sk_live_...` key from Stripe Dashboard
   - Name: `STRIPE_WEBHOOK_SECRET` → Value: the `whsec_...` secret from Stripe → Developers → Webhooks
   - Name: `EMAIL_PASS` → Value: the IONOS email password
5. Click **Deploy**

### Step 3 — Service Account Key

The `serviceAccountKey.json` file (blocked by `.gitignore`) also needs to be present
when deploying. It is stored securely in Google Cloud — do not commit it to GitHub.

To get a copy if needed:
1. Go to https://console.cloud.google.com
2. Select **forward-my-mail** project
3. Go to **IAM & Admin** → **Service Accounts**
4. Find the service account used by these functions
5. Click it → **Keys** tab → **Add Key** → **JSON**
6. Save the downloaded file as `serviceAccountKey.json` in this folder (it will be gitignored)

---

## Where to find the secret values

| Secret | Where to find it |
|---|---|
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | https://dashboard.stripe.com → Developers → Webhooks → click the endpoint → Signing secret |
| `EMAIL_PASS` | Your IONOS email account settings for info@forwardmymail.co.uk |

---

## Important notes

- **Never paste these values into index.js** — even temporarily
- **Never commit serviceAccountKey.json** — it is blocked by .gitignore but double-check before any `git add .`
- If a secret is ever exposed (e.g. accidentally committed), rotate it immediately:
  - Stripe keys: Dashboard → API keys → Roll key
  - Webhook secret: Dashboard → Webhooks → Roll secret
  - Email password: IONOS control panel
