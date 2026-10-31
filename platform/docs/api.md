# API

One REST API serves the website, the PWA and the Android/iOS apps: `/api/v1`. Requests and responses are
JSON (UTF-8); uploads are `multipart/form-data`. Interactive documentation (Swagger UI) is at `/api/docs` and
the OpenAPI document at `/api/docs-json` in development (in production only with `SWAGGER_ENABLED=true`).

## Conventions

**Envelope.** Every response has the same shape:

```json
{ "success": true, "data": { }, "message": "Added to your cart", "errors": [], "meta": { "page": 1, "pageSize": 24, "total": 120 } }
{ "success": false, "data": null, "message": "Please fix the highlighted fields.", "code": "VALIDATION_FAILED",
  "errors": [{ "field": "phone", "code": "invalid_string", "message": "Enter a valid Bangladeshi mobile number." }],
  "requestId": "…" }
```

- `code` is stable (see `ERROR_CODES` in `shared/src/api/envelope.ts`: `VALIDATION_FAILED`, `UNAUTHORIZED`,
  `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, …);
  `message` is for people. Stack traces are never returned.
- **Language:** send `Accept-Language: bn` or `en`; messages and validation errors come back in that language.
- **Pagination:** lists either take `page`/`pageSize` (`meta.page`, `meta.pageSize`, `meta.total`) or a
  cursor (`cursor` in, `meta.nextCursor` out; `null` when there is no more).
- **Money** is a decimal string in BDT (`"450.00"`) — never a float. Dates are ISO 8601 strings.
- **Rate limits:** per IP (default 120 requests a minute) and stricter on sign-in and code routes. A `429` comes
  with `Retry-After`.
- **Request ids:** send `X-Request-Id` or get one back; quote it when reporting a problem.

## Authentication

| Client | Sign in | Keep the session | Each request |
| --- | --- | --- | --- |
| Website | `POST /auth/login` (or `/auth/login/otp`, `/auth/google`) | HTTP-only refresh cookie; `POST /auth/refresh` with `X-Requested-With: boikonika` | `Authorization: Bearer <accessToken>` |
| Mobile app | the same, with `client: "android" \| "ios"`, `deviceId`, `deviceName` | refresh token returned in the body; `POST /auth/refresh { refreshToken }` | `Authorization: Bearer <accessToken>` and `X-Client-Platform` |

Access tokens last 15 minutes. Refresh tokens rotate on every use; reusing an old one signs the device
out. Accounts with two-step verification get `{ twoFactorRequired, challengeToken }` and finish with
`POST /auth/login/2fa`. Guests can fill a cart: the first `POST /cart/items` returns a `guestToken` to send
back as `X-Cart-Token`; after sign-in `POST /cart/merge` moves it into the account.

**Access** in the tables below: *public* needs no account, *signed in* needs a valid access token (and
the service checks ownership or the seller/author role where it applies), *staff* also needs the
named permission.

## Routes

<!-- Generated from the controllers (342 routes); regenerate when routes change. -->

### admin

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/overview` | staff | Platform KPIs, work queues, daily trend and what is popular (counts only, no personal data) |
| GET | `/api/v1/admin/users` | staff |  |
| GET | `/api/v1/admin/users/:id` | staff |  |
| PUT | `/api/v1/admin/users/:id/status` | staff | Suspend, ban or reactivate an account (recorded as a moderation action) |
| GET | `/api/v1/admin/audit-logs` | staff |  |
| GET | `/api/v1/admin/settings` | staff |  |
| PUT | `/api/v1/admin/settings` | staff |  |

### ai

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/ai/status` | public | Whether the reading and writing assistant is available, and how many requests are left today |
| POST | `/api/v1/ai/assist` | signed in | Ask the assistant: explain, summarise your own text, study questions, vocabulary, reading plans, grammar, improvements, ideas, outlines |

### auth

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| POST | `/api/v1/account/security/password` | signed in | Change password (optionally signing out other devices) |
| GET | `/api/v1/account/security/sessions` | signed in | Active devices |
| DELETE | `/api/v1/account/security/sessions/:id` | signed in | Sign out one device |
| POST | `/api/v1/account/security/logout-all` | signed in | Sign out of all devices (optionally keeping this one) |
| GET | `/api/v1/account/security/login-history` | signed in | Recent sign-in attempts on this account |
| POST | `/api/v1/account/security/2fa/setup` | signed in | Start two-step verification setup (secret + QR code, valid 10 minutes) |
| POST | `/api/v1/account/security/2fa/enable` | signed in | Confirm setup with a code from the authenticator app; returns one-time recovery codes |
| POST | `/api/v1/account/security/2fa/disable` | signed in | Turn off two-step verification (password + current code) |
| POST | `/api/v1/account/security/2fa/recovery-codes` | signed in | Replace the recovery codes (needs a current authenticator code) |
| POST | `/api/v1/account/security/contact/request` | signed in | Send a code to a new email or phone number to add it to the account |
| POST | `/api/v1/account/security/contact/verify` | signed in | Confirm the code and save the verified email or phone number |
| POST | `/api/v1/auth/otp/request` | public | Send a 6-digit code (register, login, reset_password; verify_email/verify_phone need a session) |
| GET | `/api/v1/auth/username-available` | public | Check whether a username is free (registration form) |
| POST | `/api/v1/auth/register` | public | Create an account with the code sent to the email or phone, and sign in |
| POST | `/api/v1/auth/login` | public | Sign in with email, BD mobile number or username and a password |
| POST | `/api/v1/auth/login/otp` | public | Passwordless sign-in with a code from POST /auth/otp/request (purpose "login") |
| POST | `/api/v1/auth/login/2fa` | public | Finish a sign-in that requires two-step verification (authenticator code or recovery code) |
| POST | `/api/v1/auth/google` | public | Sign in or sign up with a Google ID token (web, Android, iOS) |
| POST | `/api/v1/auth/refresh` | public | Rotate the refresh token (HTTP-only cookie on web, body on mobile) and get a new access token |
| POST | `/api/v1/auth/logout` | public | Sign out of this device |
| POST | `/api/v1/auth/password/forgot` | public | Send a password reset code (same response whether or not the account exists) |
| POST | `/api/v1/auth/password/reset` | public | Set a new password with the reset code; signs out every device |
| GET | `/api/v1/auth/me` | signed in | The signed-in user with roles and effective permissions |

### catalog

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/sitemap` | public | Public pages for the website sitemap (path and last change; private content left out) |
| GET | `/api/v1/home` | public | Homepage sections configured in the CMS, with their books, authors and stores |
| GET | `/api/v1/books` | public | Browse and filter books (category, genre, author, publisher, language, condition, price, rating, picks) |
| GET | `/api/v1/books/:slug` | public | Book page: editions, every seller’s offer, contributors, ratings and related books |
| GET | `/api/v1/products` | public | Browse general products (stationery, bags, electronics…) |
| GET | `/api/v1/products/:slug` | public | Product page with variants and stock (book listings redirect to their book page) |
| GET | `/api/v1/categories` | public | Category tree (optionally only book or general product categories) |
| GET | `/api/v1/categories/*path` | public | One category with its children and breadcrumbs (path like books/academic/hsc) |
| GET | `/api/v1/genres` | public |  |
| GET | `/api/v1/authors` | public | Authors (search by name in Bangla or English) |
| GET | `/api/v1/authors/:slug` | public | Author page with books |
| GET | `/api/v1/authors/:slug/follow` | signed in | Whether I follow this author |
| POST | `/api/v1/authors/:slug/follow` | signed in |  |
| DELETE | `/api/v1/authors/:slug/follow` | signed in |  |
| GET | `/api/v1/publishers/:slug` | public | Publisher page with books |
| GET | `/api/v1/stores/:slug` | public | Seller store page with books and products |
| GET | `/api/v1/search` | public | Search books, authors and products (Bangla/English, typos, ISBN) |
| GET | `/api/v1/books/:slug/also-liked` | public | Books readers of this one also have (aggregated; only readers who share their reading) |
| GET | `/api/v1/me/recommendations` | signed in | Personal picks with a reason for each, plus "because you read …" (popular books when personalisation is off) |
| GET | `/api/v1/me/search-history` | signed in | My recent searches (kept 90 days, only with personalisation on) |
| POST | `/api/v1/me/search-history` | signed in | Remember a search I made (ignored when personalisation is off) |
| DELETE | `/api/v1/me/search-history` | signed in |  |
| GET | `/api/v1/search/suggest` | public | Autocomplete suggestions (popular searches when the query is empty) |

### clubs

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/clubs` | public | Book clubs and study groups (search, type, purpose, subject, mine) |
| POST | `/api/v1/clubs` | signed in |  |
| GET | `/api/v1/clubs/:slug` | public |  |
| PATCH | `/api/v1/clubs/:slug` | signed in |  |
| PUT | `/api/v1/clubs/:slug/cover` | signed in |  |
| POST | `/api/v1/clubs/:slug/join` | signed in |  |
| DELETE | `/api/v1/clubs/:slug/membership` | signed in |  |
| GET | `/api/v1/clubs/:slug/members` | public |  |
| POST | `/api/v1/clubs/:slug/members/:userId` | signed in |  |
| POST | `/api/v1/clubs/:slug/invites` | signed in |  |
| GET | `/api/v1/clubs/:slug/posts` | public |  |
| POST | `/api/v1/clubs/:slug/posts` | signed in |  |
| DELETE | `/api/v1/clubs/:slug/posts/:postId` | signed in |  |
| PUT | `/api/v1/clubs/:slug/posts/:postId/pin` | signed in |  |
| POST | `/api/v1/clubs/:slug/events` | signed in |  |
| DELETE | `/api/v1/clubs/:slug/events/:eventId` | signed in |  |
| PUT | `/api/v1/clubs/:slug/books` | signed in | Set the book for a month (current, upcoming or finished) |
| DELETE | `/api/v1/clubs/:slug/books/:clubBookId` | signed in |  |
| POST | `/api/v1/clubs/:slug/books/:clubBookId/schedule` | signed in |  |
| DELETE | `/api/v1/clubs/:slug/schedule/:itemId` | signed in |  |
| POST | `/api/v1/clubs/:slug/polls` | signed in |  |
| POST | `/api/v1/clubs/:slug/polls/:pollId/vote` | signed in |  |

### cms

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/cms/pages` | staff |  |
| GET | `/api/v1/admin/cms/pages/:id` | staff |  |
| POST | `/api/v1/admin/cms/pages` | staff |  |
| PUT | `/api/v1/admin/cms/pages/:id` | staff |  |
| GET | `/api/v1/admin/cms/articles` | staff |  |
| GET | `/api/v1/admin/cms/articles/:id` | staff |  |
| POST | `/api/v1/admin/cms/articles` | staff |  |
| PUT | `/api/v1/admin/cms/articles/:id` | staff |  |
| PUT | `/api/v1/admin/cms/articles/:id/cover` | staff |  |
| DELETE | `/api/v1/admin/cms/articles/:id` | staff |  |
| GET | `/api/v1/admin/cms/faqs` | staff |  |
| POST | `/api/v1/admin/cms/faqs` | staff |  |
| PUT | `/api/v1/admin/cms/faqs/order` | staff |  |
| PUT | `/api/v1/admin/cms/faqs/:id` | staff |  |
| DELETE | `/api/v1/admin/cms/faqs/:id` | staff |  |
| GET | `/api/v1/admin/cms/banners` | staff |  |
| POST | `/api/v1/admin/cms/banners` | staff | Add a banner (JSON in  |
| PUT | `/api/v1/admin/cms/banners/order` | staff |  |
| PUT | `/api/v1/admin/cms/banners/:id` | staff |  |
| DELETE | `/api/v1/admin/cms/banners/:id` | staff |  |
| GET | `/api/v1/admin/homepage/sections` | staff |  |
| POST | `/api/v1/admin/homepage/sections` | staff |  |
| PUT | `/api/v1/admin/homepage/sections/order` | staff |  |
| PUT | `/api/v1/admin/homepage/sections/:id` | staff |  |
| DELETE | `/api/v1/admin/homepage/sections/:id` | staff |  |
| GET | `/api/v1/admin/homepage/testimonials` | staff |  |
| POST | `/api/v1/admin/homepage/testimonials` | staff |  |
| PUT | `/api/v1/admin/homepage/testimonials/order` | staff |  |
| PUT | `/api/v1/admin/homepage/testimonials/:id` | staff |  |
| DELETE | `/api/v1/admin/homepage/testimonials/:id` | staff |  |
| GET | `/api/v1/admin/messages` | staff |  |
| POST | `/api/v1/admin/messages/:id/reply` | staff |  |
| PUT | `/api/v1/admin/messages/:id/status` | staff |  |
| GET | `/api/v1/pages` | public | Published information pages (slug, title, last change) |
| GET | `/api/v1/pages/:slug` | public | An information page (about, terms, privacy, policies) in both languages, as Markdown |
| GET | `/api/v1/faqs` | public | Published FAQs by category |
| GET | `/api/v1/help/search` | public | Search FAQs and help articles |
| GET | `/api/v1/articles` | public | Published articles: blog, learning, announcements, study resources or help |
| GET | `/api/v1/articles/:slug` | public | An article with related reading |
| POST | `/api/v1/articles/:id/view` | public | Count a read of an article (once per reader per day) |
| GET | `/api/v1/banners` | public | Banners currently running in a placement |
| POST | `/api/v1/contact` | public | Send a message to the Boikonika team (guests leave an email for the reply) |

### commerce

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/seller/orders` | signed in | My sub-orders (online orders appear once paid) |
| GET | `/api/v1/seller/orders-summary` | signed in | How many of my sub-orders are in each status |
| GET | `/api/v1/seller/orders/:id` | signed in |  |
| POST | `/api/v1/seller/orders/:id/status` | signed in | Confirm, pack, ship (with tracking), mark delivered or cancel (with a reason) |
| POST | `/api/v1/seller/returns/:id/decision` | signed in |  |
| POST | `/api/v1/seller/returns/:id/received` | signed in |  |
| GET | `/api/v1/seller/payouts` | signed in | Balance (available, pending), payout history and payout accounts |
| POST | `/api/v1/seller/payout-accounts` | signed in |  |
| DELETE | `/api/v1/seller/payout-accounts/:id` | signed in |  |
| GET | `/api/v1/admin/orders` | staff |  |
| GET | `/api/v1/admin/orders/:number` | staff |  |
| POST | `/api/v1/admin/orders/:number/cancel` | staff |  |
| POST | `/api/v1/admin/orders/:number/refunds` | staff |  |
| GET | `/api/v1/admin/refunds` | staff |  |
| POST | `/api/v1/admin/refunds/:id/complete` | staff | Record a manual (bKash/bank) refund as paid — for cash-on-delivery orders |
| POST | `/api/v1/admin/refunds/:id/retry` | staff |  |
| GET | `/api/v1/admin/payouts` | staff |  |
| GET | `/api/v1/admin/payouts/eligible` | staff |  |
| POST | `/api/v1/admin/payouts` | staff |  |
| GET | `/api/v1/admin/payouts/:id/account` | staff | Full payout account details for making the transfer (audited) |
| POST | `/api/v1/admin/payouts/:id/paid` | staff |  |
| POST | `/api/v1/admin/payouts/:id/failed` | staff |  |
| GET | `/api/v1/admin/coupons` | staff |  |
| POST | `/api/v1/admin/coupons` | staff |  |
| PATCH | `/api/v1/admin/coupons/:id` | staff |  |
| GET | `/api/v1/me/addresses` | signed in |  |
| POST | `/api/v1/me/addresses` | signed in |  |
| PUT | `/api/v1/me/addresses/:id` | signed in |  |
| DELETE | `/api/v1/me/addresses/:id` | signed in |  |
| GET | `/api/v1/cart` | public | Cart with live prices and stock, grouped by seller |
| POST | `/api/v1/cart/items` | public |  |
| PATCH | `/api/v1/cart/items/:variantId` | public |  |
| DELETE | `/api/v1/cart/items/:variantId` | public |  |
| PUT | `/api/v1/cart/coupon` | signed in |  |
| DELETE | `/api/v1/cart/coupon` | signed in |  |
| POST | `/api/v1/cart/merge` | signed in | Move a guest cart into the signed-in user’s cart |
| GET | `/api/v1/checkout/options` | public | Delivery options and the payment methods that are currently available |
| POST | `/api/v1/checkout/quote` | signed in | Price the cart for an address, delivery option and coupon (nothing is reserved) |
| POST | `/api/v1/checkout` | signed in | Place the order (idempotent per key); returns where to pay for online methods |
| GET | `/api/v1/orders` | signed in |  |
| GET | `/api/v1/orders/:number` | signed in |  |
| POST | `/api/v1/orders/:number/cancel` | signed in |  |
| POST | `/api/v1/orders/:number/pay` | signed in | Start a new payment attempt for an unpaid online order |
| POST | `/api/v1/orders/:number/returns` | signed in |  |
| GET | `/api/v1/payments/bkash/callback` | public |  |
| POST | `/api/v1/payments/sslcommerz/:outcome` | public |  |
| GET | `/api/v1/payments/sandbox/:id` | signed in | Test payment page data (development only) |
| POST | `/api/v1/payments/sandbox/:id/complete` | signed in |  |
| GET | `/api/v1/me/wishlist` | signed in | My saved books and products |
| GET | `/api/v1/me/wishlist/contains` | signed in | Which of these books/products (comma-separated ids) I have saved |
| PUT | `/api/v1/me/wishlist/:kind/:id` | signed in |  |
| DELETE | `/api/v1/me/wishlist/:kind/:id` | signed in |  |

### community

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/feed` | public | Community feed: for you (ranked), following, latest; optional Student Zone / type / subject filters |
| POST | `/api/v1/posts` | signed in | Publish a post (JSON in  |
| GET | `/api/v1/community/books` | public | Find a book to tag in a post |
| GET | `/api/v1/posts/:id` | public |  |
| PATCH | `/api/v1/posts/:id` | signed in |  |
| DELETE | `/api/v1/posts/:id` | signed in |  |
| PUT | `/api/v1/posts/:id/like` | signed in |  |
| DELETE | `/api/v1/posts/:id/like` | signed in |  |
| PUT | `/api/v1/posts/:id/bookmark` | signed in |  |
| DELETE | `/api/v1/posts/:id/bookmark` | signed in |  |
| GET | `/api/v1/posts/:id/comments` | public |  |
| POST | `/api/v1/posts/:id/comments` | signed in |  |
| PATCH | `/api/v1/comments/:id` | signed in |  |
| DELETE | `/api/v1/comments/:id` | signed in |  |
| PUT | `/api/v1/comments/:id/like` | signed in |  |
| DELETE | `/api/v1/comments/:id/like` | signed in |  |
| GET | `/api/v1/users/:username/posts` | public |  |
| GET | `/api/v1/books/:slug/posts` | public |  |
| GET | `/api/v1/me/bookmarks` | signed in | Posts I saved |

### creators

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/seller/dashboard` | signed in | Sales for 7/30/90 days vs the previous period, daily trend, to-dos, stock alerts, top items, reviews, balance |
| GET | `/api/v1/author/dashboard` | signed in |  |
| PATCH | `/api/v1/author/profile` | signed in |  |
| PUT | `/api/v1/author/photo` | signed in |  |
| POST | `/api/v1/author/announcements` | signed in | Post an update to followers (a few per day) |
| GET | `/api/v1/author/claimable` | signed in | Unclaimed author pages matching a name |
| POST | `/api/v1/author/claims` | signed in |  |
| GET | `/api/v1/publisher/dashboard` | signed in |  |
| PATCH | `/api/v1/publisher/profile` | signed in |  |
| PUT | `/api/v1/publisher/logo` | signed in |  |
| GET | `/api/v1/admin/author-claims` | staff |  |
| POST | `/api/v1/admin/author-claims/:id/:decision` | staff |  |

### digital

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/studio/digital` | signed in | Books I can publish digitally (as their verified author or publisher) with file, offer, samples and reach |
| POST | `/api/v1/studio/digital/:bookId/file` | signed in | Upload or replace the e-book (PDF or EPUB, up to ${DIGITAL_FILE_MAX_MB} MB) with a rights declaration as JSON in \ |
| PUT | `/api/v1/studio/digital/:bookId/offer` | signed in | Offer the e-book free to everyone, or for sale through my store |
| DELETE | `/api/v1/studio/digital/:bookId/offer` | signed in | Stop offering the e-book (readers who have it keep access) |
| PUT | `/api/v1/studio/digital/:bookId/preview-length` | signed in | How much of the PDF is shown as the free sample (percent, within the site limit) |
| POST | `/api/v1/studio/digital/:bookId/chapters` | signed in | Add a sample chapter (text) |
| POST | `/api/v1/studio/digital/:bookId/pages` | signed in | Add sample page images (up to ${MAX_SAMPLE_PAGES}, optional \ |
| DELETE | `/api/v1/studio/digital/previews/:id` | signed in | Remove a sample |
| POST | `/api/v1/studio/digital/:bookId/file-link` | signed in | A short-lived link to my own uploaded file |
| POST | `/api/v1/me/library/:bookId/free` | signed in | Add a free e-book to my library |
| POST | `/api/v1/me/library/:bookId/download` | signed in | A short-lived download link for an e-book I am entitled to (logged, capped per day) |
| GET | `/api/v1/me/downloads` | signed in | My download history |
| GET | `/api/v1/books/:slug/preview` | public | Look inside: description, contents, sample chapters, sample pages and the sample PDF |
| GET | `/api/v1/admin/digital` | staff | Uploaded e-book files with their rights declarations |
| POST | `/api/v1/admin/digital/:id/takedown` | staff | Take a file down (copyright): no downloads, no sales, file kept privately for a counter-notice |
| POST | `/api/v1/admin/digital/:id/restore` | staff | Restore a taken-down file (counter-notice accepted); it comes back withdrawn |

### health

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | public | Liveness/readiness probe with database and Redis checks |

### kyc

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/kyc/verifications` | signed in | My verification requests with status timeline |
| GET | `/api/v1/admin/kyc` | staff | Verification queue (oldest first) |
| GET | `/api/v1/admin/kyc/:id` | staff | Verification details, documents (without files) and audit trail |
| GET | `/api/v1/admin/kyc/:id/documents/:documentId` | staff | Open a document: 2-minute signed URL and full number (the view is logged) |
| POST | `/api/v1/admin/kyc/:id/review` | staff | Start reviewing (pending → under review) |
| POST | `/api/v1/admin/kyc/:id/approve` | staff | Approve: grants the requested role and notifies the applicant |
| POST | `/api/v1/admin/kyc/:id/reject` | staff | Reject with a reason shown to the applicant |
| POST | `/api/v1/admin/kyc/:id/request-resubmission` | staff | Ask the applicant to submit again (e.g. a blurry photo) |

### marketplace

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/seller/me` | signed in | My seller account and store |
| PATCH | `/api/v1/seller/store` | signed in | Update store details and policies |
| PUT | `/api/v1/seller/store/:kind` | signed in | Upload the store logo or banner |
| GET | `/api/v1/seller/products` | signed in | My listings |
| GET | `/api/v1/seller/books/lookup` | signed in | Find an existing edition by ISBN before listing it |
| POST | `/api/v1/seller/books` | signed in | List a book (existing edition by ISBN/id, or a new book record) with condition, price and stock |
| POST | `/api/v1/seller/products` | signed in | List a general product with variants and stock |
| GET | `/api/v1/seller/products/:id` | signed in |  |
| PATCH | `/api/v1/seller/products/:id` | signed in | Edit a listing (details, status, variant prices) |
| DELETE | `/api/v1/seller/products/:id` | signed in |  |
| POST | `/api/v1/seller/products/:id/images` | signed in | Add photos (up to 8 per listing; resized to WebP, metadata removed) |
| DELETE | `/api/v1/seller/products/:id/images/:imageId` | signed in |  |
| POST | `/api/v1/seller/inventory/adjust` | signed in | Change stock (restock, correction, damage, return) — recorded in the stock ledger |
| GET | `/api/v1/seller/inventory/:variantId/movements` | signed in |  |
| GET | `/api/v1/admin/products` | staff |  |
| POST | `/api/v1/admin/products/:id/:decision` | staff | approve / reject / suspend / restore a listing (reason required to reject or suspend) |

### moderation

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/moderation/queue` | staff | Open reports grouped by what they are about (urgent first, then oldest) |
| POST | `/api/v1/admin/moderation/targets/:type/:id/review` | staff |  |
| POST | `/api/v1/admin/moderation/targets/:type/:id/decision` | staff | Decide all open reports about a target: warning, removal, restriction, suspension, ban or no action |
| POST | `/api/v1/admin/moderation/actions/:id/revert` | staff |  |
| GET | `/api/v1/admin/moderation/held` | staff | Posts, comments and club posts waiting for review |
| POST | `/api/v1/admin/moderation/held/:type/:id/approve` | staff |  |
| POST | `/api/v1/admin/moderation/held/:type/:id/remove` | staff |  |
| POST | `/api/v1/copyright/claims` | public | Send a copyright complaint about content on this site (rights holders or their agents) |
| GET | `/api/v1/me/standing` | signed in | My account standing: moderation decisions, active restrictions and copyright complaints about my content |
| POST | `/api/v1/me/copyright-claims/:id/counter` | signed in | Answer a takedown with a counter-notice |
| GET | `/api/v1/admin/copyright` | staff |  |
| POST | `/api/v1/admin/copyright/:id/decision` | staff |  |
| POST | `/api/v1/reports` | signed in | Report a post, comment, review, listing, user, club or store |

### notifications

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/me/notifications` | signed in | My notifications, newest first (cursor pages;  |
| GET | `/api/v1/me/notifications/unread-count` | signed in |  |
| POST | `/api/v1/me/notifications/read-all` | signed in |  |
| POST | `/api/v1/me/notifications/:id/read` | signed in |  |
| DELETE | `/api/v1/me/notifications/:id` | signed in |  |
| GET | `/api/v1/me/notification-preferences` | signed in | Channels on offer and switched on for each notification type |
| PUT | `/api/v1/me/notification-preferences` | signed in |  |
| GET | `/api/v1/push/config` | public | The VAPID public key browsers subscribe with (null when web push is not set up) |
| POST | `/api/v1/me/push-subscriptions` | signed in | Register this browser (Web Push) or app install (Expo token) for push notifications |
| DELETE | `/api/v1/me/push-subscriptions` | signed in |  |
| POST | `/api/v1/me/push-subscriptions/test` | signed in |  |
| POST | `/api/v1/admin/notifications/broadcast` | staff | Send an announcement (both languages) to everyone or one group |

### profiles

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/me/profile` | signed in | Own profile, privacy settings and interests |
| PATCH | `/api/v1/me/profile` | signed in | Update profile details, privacy, language, theme and personalisation |
| PUT | `/api/v1/me/avatar` | signed in | Upload a profile photo (JPEG, PNG or WebP, max 5 MB; cropped to a square, metadata removed) |
| DELETE | `/api/v1/me/avatar` | signed in | Remove the profile photo |
| PUT | `/api/v1/me/cover` | signed in | Upload a profile cover image |
| DELETE | `/api/v1/me/cover` | signed in | Remove the cover image |
| PUT | `/api/v1/me/interests` | signed in | Set reading interests (onboarding, at least 3); used for recommendations |
| GET | `/api/v1/me/export` | signed in | Download a copy of my personal data (JSON) |
| POST | `/api/v1/me/delete` | signed in | Delete my account (password required when the account has one) |
| GET | `/api/v1/users/:username` | public | Public profile (fields hidden according to the owner’s privacy settings) |
| GET | `/api/v1/users/:username/followers` | public | Followers of a user |
| GET | `/api/v1/users/:username/following` | public | Users this user follows |
| POST | `/api/v1/users/:username/follow` | signed in |  |
| DELETE | `/api/v1/users/:username/follow` | signed in |  |
| POST | `/api/v1/users/:username/block` | signed in |  |
| DELETE | `/api/v1/users/:username/block` | signed in |  |

### rbac

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/roles` | staff | Roles with their permissions and member counts |
| GET | `/api/v1/admin/permissions` | staff | The permission catalogue |
| PUT | `/api/v1/admin/roles/:role/permissions` | staff |  |
| GET | `/api/v1/admin/users/:id/roles` | staff |  |
| POST | `/api/v1/admin/users/:id/roles` | staff | Grant a role (admin/super admin roles need a super admin) |
| DELETE | `/api/v1/admin/users/:id/roles/:role` | staff | Remove a role (the last super admin cannot be removed) |
| PUT | `/api/v1/admin/users/:id/permissions` | staff | Grant or deny one permission for one user (null clears the override) |

### reading

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/me/library` | signed in | My Library: books on each shelf with reading progress |
| GET | `/api/v1/me/library/:bookId` | signed in |  |
| PUT | `/api/v1/me/library/:bookId` | signed in |  |
| DELETE | `/api/v1/me/library/:bookId` | signed in |  |
| GET | `/api/v1/me/reading/history` | signed in | My reading history: books started and finished, e-books downloaded |
| PUT | `/api/v1/me/reading/:bookId/progress` | signed in | Set my position in a book (finishing it completes it) |
| POST | `/api/v1/me/reading/sessions` | signed in | Log reading time (timer or manual); updates streak, goals, challenges and XP |
| DELETE | `/api/v1/me/reading/sessions/:id` | signed in |  |
| GET | `/api/v1/me/reading/stats` | signed in |  |
| GET | `/api/v1/me/reading/goals` | signed in |  |
| PUT | `/api/v1/me/reading/goals` | signed in |  |
| GET | `/api/v1/me/achievements` | signed in | Level, XP and every badge with my progress towards it |
| GET | `/api/v1/challenges` | public |  |
| GET | `/api/v1/challenges/:slug` | public |  |
| POST | `/api/v1/challenges/:slug/join` | signed in |  |
| DELETE | `/api/v1/challenges/:slug/join` | signed in |  |

### reviews

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/books/:slug/reviews` | public | Published reviews of a book (most helpful first by default) |
| GET | `/api/v1/products/:slug/reviews` | public |  |
| GET | `/api/v1/reviews/eligibility` | signed in |  |
| POST | `/api/v1/reviews` | signed in |  |
| PATCH | `/api/v1/reviews/:id` | signed in |  |
| DELETE | `/api/v1/reviews/:id` | signed in |  |
| POST | `/api/v1/reviews/:id/vote` | signed in |  |
| POST | `/api/v1/reviews/:id/reply` | signed in | Seller’s public answer to a review of their sale |
| GET | `/api/v1/me/reviews` | signed in |  |

### student

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/v1/student-zone` | public | Student Zone home: quizzes, events, competitions, scholarships, study groups, textbooks |
| GET | `/api/v1/quizzes` | public |  |
| GET | `/api/v1/quizzes/:slug` | public |  |
| POST | `/api/v1/quizzes/:slug/attempts` | signed in | Submit answers; returns the score and, now, the correct answers with explanations |
| POST | `/api/v1/quizzes` | signed in | Publish a quiz (teachers and Student Zone staff) |
| GET | `/api/v1/me/quizzes` | signed in |  |
| PUT | `/api/v1/quizzes/:slug/status` | signed in |  |
| GET | `/api/v1/me/notes` | signed in |  |
| POST | `/api/v1/me/notes` | signed in |  |
| PATCH | `/api/v1/me/notes/:id` | signed in |  |
| DELETE | `/api/v1/me/notes/:id` | signed in |  |
| GET | `/api/v1/notes/:id` | public |  |
| GET | `/api/v1/education-events` | public |  |
| GET | `/api/v1/competitions` | public |  |
| GET | `/api/v1/competitions/:slug` | public |  |
| POST | `/api/v1/competitions/:slug/entries` | signed in |  |
| GET | `/api/v1/scholarships` | public |  |
| POST | `/api/v1/admin/student/events` | staff |  |
| DELETE | `/api/v1/admin/student/events/:id` | staff |  |
| GET | `/api/v1/admin/student/competitions` | staff |  |
| POST | `/api/v1/admin/student/competitions` | staff |  |
| PUT | `/api/v1/admin/student/competitions/:slug/status` | staff |  |
| GET | `/api/v1/admin/student/competitions/:slug/entries` | staff |  |
| PUT | `/api/v1/admin/student/entries/:id` | staff |  |
| POST | `/api/v1/admin/student/scholarships` | staff |  |
| DELETE | `/api/v1/admin/student/scholarships/:id` | staff |  |

