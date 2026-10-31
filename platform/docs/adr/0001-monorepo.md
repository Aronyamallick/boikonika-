# 0001 — pnpm monorepo with a shared TypeScript package

## Context
The web app, mobile app and API must agree on roles, permissions, statuses, validation rules,
design tokens, translations and money formatting. Drift between them causes security bugs (a status
the API rejects but the UI offers) and inconsistent UX.

## Decision
One pnpm workspace (`shared`, `database`, `backend`, `web`, `mobile`, `tests`) in TypeScript.
`@boikonika/shared` holds everything that must be identical everywhere and has no runtime
dependency other than zod. `node-linker=hoisted` keeps React Native's Metro bundler happy.
Dependency versions are pinned exactly.

## Consequences
- A change to a status transition or permission is one edit, type-checked across every app.
- Libraries must be built (`pnpm build:libs`) before apps that import them; CI does this first.
- Native build scripts are allow-listed in `pnpm-workspace.yaml` (`onlyBuiltDependencies`).
