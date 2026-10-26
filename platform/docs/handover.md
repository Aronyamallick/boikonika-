# Handover

State of the Boikonika platform at the end of the build (October 2026): what exists, how it was checked,
what needs your own accounts and keys before launch, known limitations, and sensible next steps.

## What exists

| Part | Size | Where |
| --- | --- | --- |
| Database | 129 tables, 13 tracked migrations, reference and demo seeds | `database/` |
| API | 342 routes across 24 modules, scheduled jobs, notification outbox | `backend/`, [api.md](api.md) |
| Website + PWA | 92 pages, Bangla and English, light and dark, installable, offline page | `web/` |
| Android / iOS app | 5 tabs and 22 more screens on the same API, offline cache, push | `mobile/` |
| Shared package | tokens, permissions, statuses, messages (bn/en), schemas, API types | `shared/` |
| Deployment | Docker images, Compose (production and development), Nginx, CI | `infrastructure/`, `.github/` |

Feature overview: [../README.md](../README.md). Architecture: [architecture.md](architecture.md).

## How it was checked

| Check | Result |
| --- | --- |
| Shared unit tests | 140 passed |
| API tests (real PostgreSQL + Redis, full HTTP stack) | 25 suites, 140 tests passed |
| Mobile tests | 11 passed |
| Browser journeys (sign-up with codes, guest cart, checkout + cancel, community, admin access, phone layout) | 11 passed |
| Accessibility (axe, WCAG 2.1 A/AA; 35 page states in Bangla/English, light/dark, signed in) | no violations |
| Load smoke test (25 concurrent readers, one API process) | 575 req/s, 0 errors, p95 91 ms |
| Dependency audit | no unresolved issues outside the Expo CLI (see [security.md](security.md)) |
| Docker | both images build; Compose stack ran migrations and served the site and API from containers; Nginx config tested |
| Mobile app | web preview driven at phone size through browsing, guest cart, sign-in, checkout and orders, in both languages and themes |

The CI workflow (`.github/workflows/ci.yml`) runs the same checks on pull requests and pushes to `main`;
it has not run on GitHub yet.

## Needs your accounts and keys

These can't be created from the code; each is optional until you want that feature, except email and
hosting.

| For | You need | Then set |
| --- | --- | --- |
| Hosting | A server or cloud account, a domain, HTTPS | [deployment.md](deployment.md) |
| Email (required in production) | An SMTP provider | `SMTP_*`, `MAIL_FROM` |
| SMS codes and notices | A Bangladeshi SMS gateway account | `SMS_*` ([integrations.md](integrations.md)) |
| bKash | A bKash merchant account (tokenized checkout) | `BKASH_*` |
| Cards, Nagad, Rocket, banking | An SSLCOMMERZ store | `SSLCOMMERZ_*` |
| Web push | Nothing external — generate VAPID keys | `VAPID_*` |
| App builds and push | An Expo account (EAS), a Google Play developer account, an Apple Developer account; FCM and APNs credentials | `eas init`, see [mobile/README.md](../mobile/README.md) |
| Google sign-in | Google Cloud OAuth client IDs | `GOOGLE_CLIENT_IDS`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |
| AI assistant | An Anthropic API key | `ANTHROPIC_API_KEY` |
| Policy pages | Legal review of the seeded terms, privacy, returns, shipping, seller, copyright and cookie pages | Admin → Content |

## Known limitations

- **Payments:** bKash and SSLCOMMERZ follow their published APIs and are covered by tests with the gateways
  simulated, but they haven't been run against the real sandboxes (that needs merchant credentials). Do one
  real low-value payment and refund for each before launch.
- **SMS:** the HTTP driver sends a common form-encoded request; a provider with a different format needs a
  small driver.
- **Mobile app:** quizzes, study notes, challenge details, general (non-book) products, author and publisher
  pages, the saved-items list, account security, and seller/author/admin tools open the website in the
  in-app browser. Sign-in with Google and image posts (artwork) are website-only for now.
- **Real time:** notifications arrive by push and refreshed counts; there's no live chat or socket server.
- **Website CSP** allows inline scripts (a Next.js trade-off; see [security.md](security.md)).
- **Search** is PostgreSQL full-text + trigram. It's fast at the tested size; a dedicated search engine can
  replace it behind `SearchService` if the catalogue grows very large.

## Suggested next steps

1. Set up staging with `SEARCH_INDEXING=off`, fill in the integrations above, and run the go-live checklist
   in [deployment.md](deployment.md).
2. Open a pull request to `main` so CI runs on GitHub; keep it required for merges.
3. Run `eas init` and make preview builds of the app for testers.
4. Have the policy pages reviewed and published in both languages.
5. Add the mobile screens that still open the website, starting with quizzes and the saved-items list.
