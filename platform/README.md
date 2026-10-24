# Boikonika platform (বইকণিকা)

Book-first multi-vendor marketplace, social reading network and learning platform for Bangladesh.
Web + PWA (Next.js), Android/iOS (Expo React Native) and one NestJS API on PostgreSQL.

Developed by **Arieskonex Technologies**.

## Requirements

- Node.js 20.18+ (22 LTS recommended) and pnpm 10 (`corepack enable`)
- PostgreSQL 16+ and Redis 7+ (local installs or `infrastructure/docker-compose.yml`)

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
```

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm build` | Build every package and app |
| `pnpm typecheck` | Type-check the whole workspace |
| `pnpm test` | Unit + API tests (needs PostgreSQL and Redis) |
| `pnpm test:e2e` | Browser end-to-end tests |
| `pnpm db:generate` | Generate a migration from schema changes |

## Structure

```
shared/          tokens, permissions, statuses, i18n messages, validation, money/phone/ISBN utils
database/        Drizzle schema, SQL migrations, seed data
backend/         NestJS REST API + WebSocket gateway + jobs
web/             Next.js website and PWA
mobile/          Expo React Native app
tests/           end-to-end and load tests
infrastructure/  Docker, Nginx, CI/CD
docs/            architecture, ADRs, database, design system, API, deployment, security, guides
```

Start with [docs/architecture.md](docs/architecture.md).
