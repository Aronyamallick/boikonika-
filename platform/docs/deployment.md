# Deployment

Boikonika runs as two containers — the **API** (`boikonika-api`) and the **website** (`boikonika-web`) —
next to PostgreSQL 16+ and Redis 7+. Uploaded files live either on a disk volume (one server) or in
S3-compatible storage (AWS S3, Cloudflare R2, MinIO, Wasabi). The Android and iOS apps are built separately
with EAS and talk to the same API (see [mobile/README.md](../mobile/README.md)).

| Piece | Image / service | Notes |
| --- | --- | --- |
| API | `infrastructure/docker/api.Dockerfile` | NestJS on port 4000. Also runs migrations and seeds (`/app/database`). |
| Website | `infrastructure/docker/web.Dockerfile` | Next.js standalone server on port 3000. `NEXT_PUBLIC_*` values are compiled in, so build once per environment. |
| Database | PostgreSQL 16+ | Needs the `citext`, `pg_trgm`, `pgcrypto` and `unaccent` extensions (created by the first migration). |
| Cache | Redis 7+ | Rate limits, caches, locks. Losing it loses nothing permanent. |
| Proxy | Nginx (`infrastructure/nginx/boikonika.conf`) or a cloud load balancer | Routes `/api/` to the API and everything else to the website. |

## Option A — one server with Docker Compose

Good for launch and moderate traffic: 4 vCPU, 8 GB RAM and 80 GB SSD is a comfortable start
(2 vCPU / 4 GB works for testing).

1. Install Docker with the Compose plugin, point your domain's DNS at the server, and clone the repository.
2. Create the settings file and fill in every secret:

   ```bash
   cd platform
   cp infrastructure/.env.example infrastructure/.env
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # JWT_ACCESS_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"     # DATA_ENCRYPTION_KEY
   ```

   Also set `SITE_URL` (for example `https://boikonika.com`), `POSTGRES_PASSWORD`, the SMTP settings
   (email is required in production), and `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` for the first super admin.

   **Keep `DATA_ENCRYPTION_KEY` safe and backed up.** It encrypts identity-document numbers, payout
   accounts and two-step secrets; without it those values cannot be read.

3. Build, migrate and start:

   ```bash
   docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env build
   docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env run --rm migrate
   docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env up -d
   ```

   `migrate` applies the SQL migrations and the reference data (roles, permissions, categories,
   settings, the first admin). It is safe to run again.

4. Put HTTPS in front. Either let a CDN/load balancer (Cloudflare, a cloud load balancer) terminate TLS
   and forward to port 80 with `X-Forwarded-Proto`, or install certbot on the host and terminate TLS in
   Nginx. The site must be served over HTTPS in production: the API refuses to start with
   `COOKIE_SECURE=false`.

5. Check it:

   ```bash
   curl -fsS https://boikonika.com/api/v1/health
   curl -fsS https://boikonika.com/robots.txt
   curl -fsS https://boikonika.com/sitemap.xml | head
   ```

   Sign in with the seeded admin, turn on two-step verification for that account, and review
   **Admin → Settings** (commission, AI assistant limits, and so on).

### Updating

```bash
git pull
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env build
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env run --rm migrate
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env up -d
```

Migrations only add or change schema through tracked files in `database/migrations/` — never edit the
production schema by hand. Each migration is applied once and recorded in `drizzle.__drizzle_migrations`.

## Option B — managed services

For more traffic or high availability: managed PostgreSQL (with automated backups and point-in-time
recovery), managed Redis, S3 or Cloudflare R2 for uploads, and two or more API and website containers
behind a load balancer (any container platform: ECS, Cloud Run, Fly.io, Kubernetes, a DigitalOcean App).

- Build the images with the commands at the top of each Dockerfile and push them to your registry.
- Run the migrate command (`node dist/migrate.js && node dist/seed/index.js` in `/app/database`) as a
  one-off task before rolling out a new API version.
- Several API instances can run together: scheduled jobs take a Redis lock and the message outbox leases
  each message, so nothing is processed twice.
- Set `TRUST_PROXY=true` when the API is behind exactly one proxy hop so rate limits see the real client IP.
- Uploads: `STORAGE_DRIVER=s3` with `S3_*`. Create two buckets: a **public** one (covers, avatars, banners;
  serve it through a CDN and set `S3_PUBLIC_BASE_URL`) and a **private** one (identity documents, e-books;
  never public). `S3_ENDPOINT` must be reachable from browsers, because private files are handed out as
  short-lived signed links (true for S3 and R2).

## Environment variables

### API (`backend/.env.example` lists every one with comments)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` in production. Enables the production safety checks. |
| `APP_URL`, `API_URL` | yes | The website's address and the API's public address (often the same origin). |
| `CORS_ORIGINS` | yes | Comma-separated origins allowed to call the API from a browser (the website). |
| `DATABASE_URL` | yes | PostgreSQL connection string. `DATABASE_SSL=true` for managed databases that require TLS. |
| `REDIS_URL` | yes | Redis connection string. |
| `JWT_ACCESS_SECRET` | yes | At least 32 random characters; placeholders are refused in production. |
| `DATA_ENCRYPTION_KEY` | yes | 32 random bytes, base64. Encrypts sensitive columns and signs local file links. |
| `COOKIE_SECURE` | yes | Must be `true` in production. `COOKIE_DOMAIN` only if the API and site share a parent domain. |
| `TRUST_PROXY` | behind a proxy | `true` behind one reverse proxy / load balancer. |
| `STORAGE_DRIVER` + `STORAGE_LOCAL_DIR` or `S3_*` | yes | Where uploads go (see above). |
| `MAIL_DRIVER=smtp` + `SMTP_*`, `MAIL_FROM` | yes (production) | Verification codes, receipts, notices. `log` (development) only prints them and is refused in production. |
| `SMS_DRIVER=http` + `SMS_*` | for SMS | Codes to mobile numbers; see [integrations.md](integrations.md). |
| `BKASH_*`, `SSLCOMMERZ_*` | for online payments | Merchant credentials and the **production** base URLs. Without them only cash on delivery is offered. |
| `PAYMENT_SANDBOX_ENABLED` | no | Simulated gateway for testing (on by default outside production); the API refuses to start with it in production. |
| `VAPID_*`, `EXPO_ACCESS_TOKEN` | for push | Web Push keys (`npx web-push generate-vapid-keys`) and Expo push (mobile). |
| `GOOGLE_CLIENT_IDS` | for Google sign-in | OAuth client IDs for web, Android and iOS, comma-separated. |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | for the AI assistant | Optional. Without a key the assistant is shown as unavailable. |
| `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX` | no | Requests per minute per IP (default 120) and per sign-in route (default 10). |
| `SWAGGER_ENABLED` | no | API docs at `/api/docs`; off in production unless set. |
| `PLATFORM_COMMISSION_PERCENT` | no | Default commission on seller sales (also editable in admin settings). |

### Website

| Variable | When | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | build | The site's public address (canonical URLs, sitemap, Open Graph). |
| `NEXT_PUBLIC_API_URL` | build | Where browsers call the API (usually the same origin). |
| `NEXT_PUBLIC_ASSETS_URL` | build | Public media origin when it differs (CDN / public bucket). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | build | Shows "Continue with Google". |
| `API_INTERNAL_URL` | build + run | Private address for server-side requests, e.g. `http://api:4000`. |
| `SEARCH_INDEXING` | run | `off` on staging: robots.txt then blocks all crawlers. |

## Backups and recovery

- **Database:** daily `pg_dump --format=custom` kept for at least 30 days, plus point-in-time recovery on
  managed PostgreSQL. Test a restore every quarter:

  ```bash
  docker compose -f infrastructure/docker-compose.yml exec -T postgres pg_dump -U boikonika -Fc boikonika > boikonika-$(date +%F).dump
  pg_restore --clean --if-exists -d "$DATABASE_URL" boikonika-YYYY-MM-DD.dump
  ```

- **Uploads:** back up the `uploads` volume (or enable versioning on the S3/R2 buckets). The private bucket
  holds identity documents: keep its backups encrypted and access-controlled, and remember that documents
  past their retention date are deleted on purpose.
- **Secrets:** keep `infrastructure/.env` (or your secret manager's values) in a password manager.
  Losing `DATA_ENCRYPTION_KEY` makes encrypted columns unreadable.
- Redis needs no backup.

## Monitoring

- Health: `GET /api/v1/health` checks the database and Redis: `ok`, `degraded` (Redis down, still serving)
  or `down` with status 503 (database unreachable). Use it for load-balancer checks and uptime alerts.
- Logs: one line per request with a request id (also returned as `X-Request-Id`, and shown to people in
  error messages so support can find the request). Ship container logs to your log service.
- Watch: 5xx rate, p95 latency, database CPU and connections, Redis memory, the `outbound_messages` queue
  (`status = 'queued'` growing means email/SMS delivery is failing), and failed payments.
- Load check before launch: `pnpm --filter @boikonika/tests load` against a staging API (see
  [testing.md](testing.md)).

## Go-live checklist

- [ ] HTTPS everywhere; `COOKIE_SECURE=true`; HSTS is sent automatically over HTTPS.
- [ ] Fresh `JWT_ACCESS_SECRET` and `DATA_ENCRYPTION_KEY`, stored in a password manager or secret store.
- [ ] Database backups scheduled and one restore tested.
- [ ] SMTP and SMS working (sign up with a real email and a real mobile number).
- [ ] bKash and SSLCOMMERZ production credentials and production base URLs; one real low-value payment
      and refund made end to end.
- [ ] Web Push keys and Expo access token set if push is wanted; Google client IDs if Google sign-in is wanted.
- [ ] Admin accounts use two-step verification; the seeded admin's password changed.
- [ ] Policy pages (terms, privacy, returns, shipping, seller, copyright, community guidelines, cookies)
      reviewed in **Admin → Content** in both languages.
- [ ] `SEARCH_INDEXING` unset in production, `off` on staging.
- [ ] Mobile apps built with `EXPO_PUBLIC_API_URL` pointing at production (see the mobile README).
