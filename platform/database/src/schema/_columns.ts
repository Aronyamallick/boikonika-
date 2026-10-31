import { sql } from 'drizzle-orm';
import { char, customType, jsonb, numeric, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Case-insensitive text (emails, usernames, coupon codes) — requires the citext extension. */
export const citext = customType<{ data: string }>({ dataType: () => 'citext' });

/** Full-text search vector, maintained by generated columns. */
export const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

export const id = () => uuid('id').primaryKey().defaultRandom();

export const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
export const timestamps = () => ({ createdAt: createdAt(), updatedAt: updatedAt() });

/** Money: NUMERIC(14,2) — exact decimal, never a float. Read/written as strings ("1250.00"). */
export const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
export const currency = () => char('currency', { length: 3 }).notNull().default('BDT');

/** Bilingual content stored together: { bn: "…", en: "…" }. */
export type I18nText = { bn?: string; en?: string };
export const i18n = (name: string) => jsonb(name).$type<I18nText>();

export const nowSql = sql`now()`;
