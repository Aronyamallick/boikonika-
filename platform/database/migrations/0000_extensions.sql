-- Extensions required by the schema. Managed providers (RDS, Cloud SQL, Supabase, Neon) allow
-- all four; on self-hosted PostgreSQL install the "postgresql-contrib" package.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid() (built in since PG13, kept for older servers)
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email / username / coupon codes
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- typo-tolerant search, autocomplete (GIN trigram indexes)
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- accent-insensitive matching for Latin-script names
