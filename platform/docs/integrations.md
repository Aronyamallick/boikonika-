# Integrations

Every external service is optional in development: without credentials the API uses a safe stand-in
(messages are printed, payments use the sandbox, push and AI are shown as unavailable). Configure them
with the environment variables below (see [deployment.md](deployment.md) for where they go).

## Payments

The checkout offers whatever is configured; cash on delivery is always available for printed books.
Card details never reach Boikonika — people pay on the gateway's page and the API verifies the result with
the gateway before marking an order paid.

### bKash (tokenized checkout)

| Variable | Value |
| --- | --- |
| `BKASH_BASE_URL` | Sandbox `https://tokenized.sandbox.bka.sh/v1.2.0-beta`; production URL from bKash |
| `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` | Merchant credentials from bKash |

Callback (sent by the API when creating the payment): `{API_URL}/api/v1/payments/bkash/callback`.

### SSLCOMMERZ (cards, internet banking, Nagad, Rocket)

| Variable | Value |
| --- | --- |
| `SSLCOMMERZ_BASE_URL` | Sandbox `https://sandbox.sslcommerz.com`; production `https://securepay.sslcommerz.com` |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD` | Store credentials from SSLCOMMERZ |

Return URLs: `{API_URL}/api/v1/payments/sslcommerz/success|fail|cancel`; IPN:
`{API_URL}/api/v1/payments/sslcommerz/ipn` (also set it in the SSLCOMMERZ merchant panel).

Unpaid online orders are cancelled after their payment deadline (checked every minute, after asking the
gateway once more). Approved refunds are sent to the gateway they were paid with; cash-on-delivery refunds
are paid out by staff and recorded in **Admin → Refunds**.

### Sandbox

Outside production a simulated gateway (`PAYMENT_SANDBOX_ENABLED`, on by default in development) lets you
test paid, failed and cancelled payments without money. The API refuses to start with it in production.

## Email (SMTP)

`MAIL_DRIVER=smtp`, `SMTP_HOST`, `SMTP_PORT` (587 with STARTTLS, or 465 with `SMTP_SECURE=true`),
`SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Any provider works (Amazon SES, Mailgun, Brevo, Google Workspace…).
Messages go through the database outbox, so a provider outage delays mail instead of losing it.

## SMS

`SMS_DRIVER=http` sends verification codes and order notices through a Bangladeshi SMS gateway that accepts
a form POST:

```
POST {SMS_API_URL}
Content-Type: application/x-www-form-urlencoded

api_key={SMS_API_KEY}&senderid={SMS_SENDER_ID}&number=8801XXXXXXXXX&message=…
```

Many Bangladeshi bulk-SMS providers accept this form; check your provider's field names. Any non-2xx reply
is treated as a failure and retried. A gateway with a different format needs a small driver in
`backend/src/infra/messaging/drivers.ts`.

## Push notifications

- **Website (Web Push):** generate keys once with `npx web-push generate-vapid-keys` and set
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` address). Keep the same keys across
  deploys, or every browser subscription stops working.
- **Mobile app (Expo push):** set `EXPO_ACCESS_TOKEN` if your Expo project requires authenticated sends, and
  configure FCM (Android) and APNs (iOS) credentials in EAS — see the mobile README.

People turn push on themselves, per browser or phone; which kinds of notices arrive by push, email or SMS
is chosen in their notification settings.

## Google sign-in

Create OAuth client IDs (Web, Android, iOS) in Google Cloud Console. Set them comma-separated in
`GOOGLE_CLIENT_IDS` on the API, and the web client ID in `NEXT_PUBLIC_GOOGLE_CLIENT_ID` when building the
website. The API verifies Google's ID token against Google's published keys.

## AI assistant (optional)

`ANTHROPIC_API_KEY` turns on the reading and writing assistant (Claude). `AI_MODEL` defaults to
`claude-opus-5-5`. Admins set the daily request limit per reader in **Admin → Settings**
(`ai.dailyRequests`, 0 turns the assistant off). The assistant explains and studies books, helps with the
reader's own writing, refuses to imitate living authors or reproduce copyrighted text, and only usage
counts are stored.

## File storage

`STORAGE_DRIVER=local` (a directory or Docker volume) or `s3` for any S3-compatible service — AWS S3,
Cloudflare R2, Wasabi, MinIO. With S3 set `S3_ENDPOINT` (blank for AWS), `S3_REGION`, credentials,
`S3_BUCKET_PUBLIC` / `S3_BUCKET_PRIVATE`, and `S3_PUBLIC_BASE_URL` (the CDN or public bucket address).
The private bucket must not allow public reads.
