import { bigserial, boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt } from './_columns';
import { users } from './identity';

/**
 * Product analytics events (page/product views, searches, add-to-cart, checkout, purchase…).
 * No personal data beyond the user id; anonymous visitors get a random per-device id. Rows older
 * than the retention window are aggregated into daily stats and deleted by a scheduled job.
 */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    event: varchar('event', { length: 40 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    anonymousId: varchar('anonymous_id', { length: 64 }),
    entityType: varchar('entity_type', { length: 20 }),
    entityId: uuid('entity_id'),
    sellerId: uuid('seller_id'),
    properties: jsonb('properties').$type<Record<string, unknown>>(),
    platform: varchar('platform', { length: 10 }).notNull().default('web'),
    createdAt: createdAt(),
  },
  (t) => [
    index('analytics_events_event_time_idx').on(t.event, t.createdAt),
    index('analytics_events_entity_idx').on(t.entityType, t.entityId, t.createdAt),
    index('analytics_events_seller_idx').on(t.sellerId, t.createdAt),
  ],
);

/** Append-only audit log of security-relevant and administrative actions (who, what, before/after). */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 80 }).notNull(), // e.g. user.ban, kyc.approve, refund.approve, settings.update
    entityType: varchar('entity_type', { length: 40 }).notNull(),
    entityId: varchar('entity_id', { length: 64 }),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    requestId: varchar('request_id', { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_entity_idx').on(t.entityType, t.entityId, t.createdAt), index('audit_logs_actor_idx').on(t.actorId, t.createdAt), index('audit_logs_action_idx').on(t.action, t.createdAt)],
);

/** Typed key/value settings editable by super admins (commission, preview %, feature flags…). */
export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 80 }).primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  description: text('description'),
  isPublic: boolean('is_public').notNull().default(false),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** AI assistant usage (for per-user daily quotas and cost monitoring). */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    feature: varchar('feature', { length: 30 }).notNull(),
    model: varchar('model', { length: 60 }).notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('ai_usage_user_time_idx').on(t.userId, t.createdAt)],
);
