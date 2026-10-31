# Security

How Boikonika protects accounts, money, identity documents and readers' privacy, what was reviewed before
launch, and the risks that are knowingly accepted. Report vulnerabilities to **support@boikonika.com** with
"Security" in the subject (Arieskonex Technologies); please don't test against other people's accounts or
real payments.

## Threat model in brief

| Asset | Main threats | Controls |
| --- | --- | --- |
| Accounts | Credential stuffing, OTP brute force, session theft | Argon2id hashes, per-IP and per-route rate limits, account lockout after repeated failures, short-lived access tokens, refresh-token rotation with reuse detection, optional TOTP two-step verification, new-device sign-in alerts. |
| Money (orders, payouts, refunds) | Price tampering, double orders, forged payment callbacks, overselling | Server-side pricing and quotes, idempotency keys on checkout and payment retries, gateway re-verification before marking paid, conditional stock updates with CHECK constraints, append-only inventory ledger, permission-checked refunds and payouts. |
| Identity documents (KYC) | Leaks, over-retention, staff misuse | Private storage only, short-lived signed links after a permission check, document numbers encrypted (AES-256-GCM) and never shown in full, append-only review history, automatic deletion after the retention period. |
| Content | XSS, spam, copyright infringement, harassment | React escaping, Markdown rendered as a tree (never HTML), safe link schemes only, image re-encoding, moderation queue and reports, copyright claims with counter-notices, rights declarations for e-books. |
| Privacy | Over-collection, profiling, exposure | Minimal sign-up data, privacy settings, opt-in push, no third-party trackers, data export and account deletion, AI usage stored as counts only. |

## Authentication and sessions

- Passwords: Argon2id (`m=19456, t=2, p=1`), 8–128 characters with letters and numbers. Never stored or
  logged in plain text.
- Sign-up proves the email or phone with a 6-digit code (`OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`), throttled
  per target and per IP.
- Access token: JWT, 15 minutes. Refresh token: random, stored hashed, rotated on every use; presenting an
  old one revokes the session (`token_reuse`).
- Website: refresh token in an HTTP-only, `Secure`, `SameSite=Lax` cookie scoped to `/api/v1/auth`. Cookie
  endpoints also require the `X-Requested-With: boikonika` header and an allowed `Origin` (CSRF).
- Mobile app: refresh token in the Keychain / Keystore (`expo-secure-store`); access token in memory only.
  Sign-out also removes the phone's push subscription.
- Two-step verification (TOTP) with hashed, single-use recovery codes; attempts on a challenge are capped.
- Sessions and login history are visible to the account owner, who can sign out any device or all devices.

## Authorization

- Every route is private unless marked `@Public()`. Permissions come from roles plus per-user grants and
  are checked on the server for every request (`@RequirePermissions`). All admin routes are covered —
  checked by a script during the launch review.
- Services enforce ownership on top of permissions: buyers only see their orders, sellers only their seller
  orders and listings, club moderators only their club.
- The website and app hide what a person can't do, but never rely on that.

## Data protection

- Sensitive columns (identity-document numbers, payout accounts, 2FA secrets) are encrypted with
  AES-256-GCM using `DATA_ENCRYPTION_KEY`. National ID numbers are never returned in full.
- Private files are never publicly addressable. Downloads use signed links that expire in minutes
  (`SIGNED_URL_TTL_SECONDS`), issued only after an access check (e-book owned, staff reviewing a document).
- No card data is stored: card, bKash, Nagad and Rocket payments happen on the gateway's page.
- Money is stored as `NUMERIC(14,2)` and computed in integer poisha — never floating point.
- `audit_logs`, `kyc_events` and `inventory_movements` are append-only (database triggers).

## Input, output and files

- Every body and query is validated with zod schemas from `shared/` (unknown fields dropped, sizes bounded).
  JSON bodies are limited to 1 MB.
- SQL uses parameterised queries (Drizzle and tagged `sql`); the few raw identifiers are from fixed
  allow-lists.
- Uploads: per-route size and count limits; types detected from file contents; images re-encoded (which also
  strips location and other metadata); PDFs and EPUBs checked before storage; private files served with
  `nosniff` and a sandboxing CSP.
- Errors never include stack traces: clients get a stable `code`, a translated message and the request id.

## HTTP hardening

- API: Helmet headers, `default-src 'none'` CSP, HSTS in production, CORS allow-list, per-IP rate limits in
  Redis (and optionally in Nginx), `TRUST_PROXY` for correct client IPs behind one proxy.
- Website: CSP limiting scripts, styles, images and connections to the site, the API and (when enabled)
  Google sign-in; `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy,
  camera/microphone/location disabled by Permissions-Policy, HSTS over HTTPS.
- **Accepted:** the website's CSP allows inline scripts. Next.js streams pages with inline script chunks;
  removing `'unsafe-inline'` needs per-request nonces, which turns off static and cached rendering for every
  page. XSS is mitigated by React escaping, tree-rendered Markdown, safe link schemes, and the absence of
  `dangerouslySetInnerHTML` with user content (it is used only for the theme script and for JSON-LD, which
  is escaped).

## Production safety checks

The API refuses to start in production when: `COOKIE_SECURE` is false, `JWT_ACCESS_SECRET` looks like a
placeholder, email would only be printed (`MAIL_DRIVER=log`), the payment sandbox is enabled, or S3
storage lacks credentials. Swagger is off unless
`SWAGGER_ENABLED=true`. The development outbox endpoint only exists outside production.

## Dependencies

`pnpm audit --prod` runs in CI and fails on critical advisories. At the launch review (October 2026):

- Fixed: drizzle-orm (SQL identifier escaping) → 0.45.4, nodemailer (address parsing) → 10.2.1; pnpm
  overrides for multer (DoS), postcss under Next.js, js-yaml under Swagger.
- **Accepted:** `node-forge` and `zod@3` inside `@expo/cli`. The Expo CLI is a developer tool used to build
  the app; it is not part of the API, the website or the shipped app. Re-check when Expo updates them.

## Privacy controls

- Privacy settings choose who sees the profile, reading stats, library and activity (everyone, followers or
  only me), and personalised recommendations can be switched off. Posts have their own visibility.
- Push notifications are off until the person turns them on (the app never asks at launch); every
  non-security notice type can be turned off per channel.
- Readers can download their data and delete their account from account settings.
- Only public, non-private content is in the sitemap; people's profiles are not listed.
- The AI assistant is optional, never shown to people as a human, refuses to imitate living authors or
  reproduce copyrighted books, and stores only usage counts.

## Launch review checklist (done)

- [x] Dependency audit and upgrades (above).
- [x] Secret scan of the repository (no keys, tokens or `.env` files committed).
- [x] Raw SQL reviewed: identifiers only from fixed allow-lists.
- [x] Every admin route requires a permission.
- [x] Every upload route has size and count limits; uploads checked by content.
- [x] Outbound requests only go to configured endpoints (payment gateways, SMS, Expo, Google keys) — no
      user-supplied URLs are fetched server-side.
- [x] Cookie endpoints protected against CSRF; tokens never in URLs.
- [x] Public endpoints that do heavy work are cached (home page sections, sitemap).
