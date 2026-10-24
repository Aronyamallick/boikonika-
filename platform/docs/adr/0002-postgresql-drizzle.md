# 0002 — PostgreSQL 16 as the only primary database, Drizzle ORM

## Context
Orders, payments, payouts, inventory and KYC need ACID transactions, foreign keys and constraints
that the database itself enforces. Search must handle Bangla and English with typo tolerance.

## Decision
- PostgreSQL 16 is the single source of truth (no MongoDB/Firebase). Extensions: `pgcrypto`
  (UUIDs), `citext` (emails, usernames), `pg_trgm` (fuzzy search), `unaccent`.
- Drizzle ORM: schema in TypeScript, generated SQL migrations committed to git, no runtime query
  engine binary, full access to SQL features (generated columns, partial unique indexes, CHECK
  constraints, GIN indexes) that Prisma cannot express without raw SQL.
- Custom SQL migrations for triggers and views (`updated_at` maintenance, append-only ledgers).
- Conventions: UUID primary keys, `created_at`/`updated_at` timestamptz, `deleted_at` for soft
  deletes where history matters, bilingual text as `jsonb {bn, en}`.

## Consequences
- Integrity rules (no negative stock, compare-at price ≥ price, one open KYC request per purpose,
  ISBN uniqueness, append-only audit trails) hold even if application code has a bug.
- Every schema change goes through `pnpm db:generate` → review SQL → `pnpm db:migrate`; production is
  never changed by hand.
