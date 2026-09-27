# Production deployment checklist (Hostinger)

This is a server-rendered Next.js application. Deploy it as a **Node.js Web App**, not as a static export: it needs Server Actions, API routes, PayPal webhooks, image uploads, and the protected hold-expiry job. Hostinger currently lists Next.js as a supported backend framework on Business Web Hosting and Cloud plans: [Hostinger Node.js deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

## Before the first deployment

1. Apply the Supabase migrations through migration `009_booking_integrity_and_payment_safety.sql`. It prevents concurrent appointment overlaps and removes the legacy public appointment-write policy.
2. Rotate the Cloudinary API secret that was previously committed in source code. Put the replacement only in Hostinger environment variables.
3. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS domain, without a trailing slash. Never use `localhost` in production.
4. Create a separate live PayPal app and webhook. Do not reuse Sandbox credentials.
5. Verify the sender/domain in Resend before enabling customer emails.

## Hostinger Web App settings

- Framework: Next.js
- Node.js: 20.x or 22.x
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Deployment source: connect the production Git branch, then require a successful build before promotion.

Hostinger supports deployment from GitHub or a ZIP upload and lets each web app have its own environment variables. See [Hostinger’s deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

## Required environment variables

Copy the variable names from `.env.example` into Hostinger’s environment-variable panel. These need real production values:

```text
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
BOOKING_HOLD_CRON_SECRET=

RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_STUDIO_WHATSAPP=

PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_USD_PER_IDR=

WISE_RECIPIENT_NAME=
WISE_BANK_NAME=
WISE_ACCOUNT_DETAILS=
WISE_REFERENCE_NOTE=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Generate `ADMIN_SESSION_SECRET` and `BOOKING_HOLD_CRON_SECRET` as separate, long random values. Do not commit `.env.local`, and never expose `SUPABASE_SERVICE_ROLE_KEY` in a variable prefixed with `NEXT_PUBLIC_`.

## PayPal live webhook

In the **live** PayPal developer dashboard, add this webhook URL:

```text
https://your-domain.com/api/webhook/paypal
```

Subscribe to `PAYMENT.CAPTURE.COMPLETED`, then copy that webhook’s ID into `PAYPAL_WEBHOOK_ID`. Complete a small live payment and refund it after confirming that the payment page, booking status, and receipt email update correctly.

## Expire unpaid slot holds

Create a Hostinger **Custom** cron job that runs every 15 minutes. Its command should be equivalent to the following, with the real domain and secret inserted in Hostinger only:

```bash
curl -fsS -X POST https://your-domain.com/api/internal/expire-booking-holds -H "Authorization: Bearer YOUR_BOOKING_HOLD_CRON_SECRET"
```

The endpoint releases only unpaid initial booking holds. It intentionally does not release a Wise transfer that is already waiting for studio review. Hostinger’s cron tasks use UTC, so use the dashboard’s schedule preview when choosing the cadence: [Hostinger cron documentation](https://support.hostinger.com/en/articles/1583465-how-to-set-up-a-cron-job-at-hostinger).

## Launch checks

1. Test flash and custom bookings, including a blocked date and a time outside opening hours.
2. Confirm a pending initial payment blocks the slot, then confirm the cron releases it after the configured 6–12 hour hold.
3. Test Wise: invalid reference, submitted reference, admin approval, decline, and approval after a decline.
4. Test PayPal Sandbox on staging first. On live, make one small capture only after the webhook is configured.
5. Confirm every email uses the live domain and a verified Resend sender.
6. Confirm `/admin` rejects an unauthenticated request and that the customer-facing pages do not expose admin controls or secrets.
