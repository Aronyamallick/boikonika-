# Testing

| Layer | Where | Runs | Needs |
| --- | --- | --- | --- |
| Shared unit tests | `shared/src/**/*.test.ts` | `pnpm --filter @boikonika/shared test` | nothing |
| API tests | `backend/test/*.e2e-spec.ts`, `backend/src/**/*.spec.ts` | `pnpm --filter @boikonika/backend test` | PostgreSQL + Redis |
| Mobile tests | `mobile/src/__tests__` | `pnpm --filter @boikonika/mobile test` | nothing |
| Browser end-to-end | `tests/e2e` | `pnpm test:e2e` | running API + website, seeded data |
| Accessibility | `tests/a11y` | `pnpm --filter @boikonika/tests a11y` | running API + website |
| Load smoke test | `tests/load/smoke.mjs` | `pnpm --filter @boikonika/tests load` | running API with a raised rate limit |
| Type checks | every package | `pnpm typecheck` | nothing |

CI runs all of them on every pull request (`.github/workflows/ci.yml`), plus `pnpm audit` and the Docker
image builds.

## API tests

They exercise the real HTTP stack (the same `configureApp` as production) against a separate database:

```bash
createdb boikonika_test                      # once
pnpm build:libs
TEST_DATABASE_URL=postgres://…/boikonika_test pnpm --filter @boikonika/backend test
```

The test run migrates and seeds that database, uses Redis database 15, local file storage and printed
email/SMS, and resets data between tests. Never point it at a real database.

## Browser tests

```bash
pnpm db:migrate && pnpm db:seed && pnpm db:seed:demo   # demo catalogue + SEED_ADMIN_* admin
pnpm dev:api                                           # development mode keeps sign-up codes in the dev outbox
pnpm dev:web
pnpm --filter @boikonika/tests exec playwright install chromium   # once
E2E_BASE_URL=http://localhost:3000 E2E_API_URL=http://localhost:4000 pnpm test:e2e
```

Projects: `desktop` (journeys), `mobile` (phone layout, Pixel 7) and `a11y` (axe, WCAG 2.1 A/AA, Bangla and
English, light and dark). The journeys sign up real accounts with the code from the development outbox,
place and cancel a cash-on-delivery order, post and comment, and check that readers can't reach admin.
Admin credentials come from `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` (defaults match the local seed).

## Load smoke test

```bash
RATE_LIMIT_MAX=1000000 pnpm dev:api          # every simulated reader shares one IP
E2E_API_URL=http://localhost:4000 LOAD_CONCURRENCY=25 LOAD_SECONDS=20 pnpm --filter @boikonika/tests load
```

It mixes home page, book lists, search, book pages, the feed and categories, prints p50/p95/p99 per route,
and fails when more than 1% of requests error or p95 exceeds `LOAD_P95_MS` (800 ms by default). Run it
against staging before a launch or a big campaign.

Baseline (October 2026, one API process and PostgreSQL on a 4-vCPU development container, demo catalogue,
25 readers for 20 s): 575 requests/s, no errors, p95 91 ms overall. Slowest route: search, p95 125 ms.

## Mobile app

`pnpm --filter @boikonika/mobile test` covers the API client (session headers, single refresh, retry on
401, sign-out only when the refresh token is rejected), website-link routing, the offline cache and key
components in Bangla. For screens, export the web preview (`pnpm --filter @boikonika/mobile export:web`)
and drive it with Playwright at phone size, or run the app in an emulator against a local API.
