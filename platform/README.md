# Boikonika platform (বইকণিকা)

Book-first multi-vendor marketplace, social reading network and learning platform for Bangladesh:
a Next.js website and PWA, Android and iOS apps (Expo React Native), and one NestJS API on PostgreSQL that
serves them all. Bangla first, English throughout, light and dark themes.

Developed by **Arieskonex Technologies**.

## What's in it

- **Marketplace:** books with editions and ISBNs, offers from many sellers (new and used), general
  products, cart for guests and accounts, coupons, one checkout split into per-seller orders, bKash,
  SSLCOMMERZ (cards, Nagad, Rocket, internet banking) and cash on delivery, shipping and tracking, returns,
  refunds, seller payouts and commission.
- **Sellers, authors, publishers:** identity verification (private, encrypted documents), store and
  listing management, inventory ledger, order handling, dashboards, e-book publishing with rights
  declarations and previews.
- **Reading and community:** library shelves, reading progress and timer, goals, streaks, badges and
  challenges, reviews, posts and comments, book clubs and study groups, recommendations.
- **Student Zone:** quizzes, study notes, events, competitions, scholarships, textbooks.
- **Platform:** notifications (in-app, Web Push, Expo push, email, SMS) with per-person preferences,
  moderation and copyright claims, CMS (homepage builder, pages, articles, FAQs), admin dashboards, audit
  log, an optional AI reading and writing assistant, SEO (sitemap, hreflang, structured data).

## Requirements

- Node.js 20.18+ (22 LTS recommended) and pnpm 10 (`corepack enable`)
- PostgreSQL 16+ and Redis 7+ — local installs, or `docker compose -f infrastructure/docker-compose.dev.yml up -d`

## Quick start

```bash
pnpm install
pnpm build:libs                         # shared + database packages

cp backend/.env.example backend/.env    # then fill JWT_ACCESS_SECRET and DATA_ENCRYPTION_KEY
cp database/.env.example database/.env  # DATABASE_URL, optional SEED_ADMIN_*
cp web/.env.example web/.env.local

pnpm db:migrate                         # apply migrations
pnpm db:seed                            # reference data + first super admin
pnpm db:seed:demo                       # optional demo catalogue for development

pnpm dev:api                            # http://localhost:4000/api/v1 (docs at /api/docs)
pnpm dev:web                            # http://localhost:3000 (Bangla) and /en (English)
pnpm dev:mobile                         # Expo; see mobile/README.md
```

In development, email and SMS are printed by the API instead of sent, and payments use a simulated
gateway.

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm build` | Build the libraries, the API and the website |
| `pnpm typecheck` | Type-check every package |
| `pnpm test` | Unit, API and mobile tests (the API tests need PostgreSQL and Redis) |
| `pnpm test:e2e` | Browser end-to-end and accessibility tests against a running stack |
| `pnpm --filter @boikonika/tests load` | Load smoke test (see docs/testing.md) |
| `pnpm db:generate` | Generate a migration from schema changes |

## Structure

```
shared/          tokens, permissions, statuses, i18n messages (bn, en), validation, API response types, utils
database/        Drizzle schema, SQL migrations, seed data
backend/         NestJS REST API + scheduled jobs and the notification outbox
web/             Next.js website and PWA
mobile/          Expo React Native app (Android, iOS)
tests/           Playwright end-to-end and accessibility tests, load smoke test
infrastructure/  Dockerfiles, Docker Compose (production and development), Nginx
docs/            architecture, ADRs, database, design system, API, deployment, security, testing, guides
```

CI is in `../.github/workflows/ci.yml`.

## Documentation

| Read | For |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | How the pieces fit, modules, background jobs, key decisions |
| [docs/adr/](docs/adr/README.md) | Architecture decision records |
| [docs/database.md](docs/database.md) | Schema overview and conventions |
| [docs/design-system.md](docs/design-system.md) | Colours, type, components, dark mode, accessibility |
| [docs/api.md](docs/api.md) | API conventions and the route index |
| [docs/deployment.md](docs/deployment.md) | Deploying with Docker Compose or managed services, environment variables, backups, go-live checklist |
| [docs/integrations.md](docs/integrations.md) | Payments, email, SMS, push, Google sign-in, AI, storage |
| [docs/security.md](docs/security.md) | Threat model, controls, launch review, accepted risks |
| [docs/testing.md](docs/testing.md) | Test layers and how to run them, performance baseline |
| [docs/guides/](docs/guides/README.md) | Guides for admins, sellers and authors/publishers |
| [mobile/README.md](mobile/README.md) | Running and building the Android and iOS apps |
| [docs/handover.md](docs/handover.md) | Project status, what needs your accounts and keys, next steps |
