import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id } from './_columns';
import { notificationChannelEnum, notificationTypeEnum, outboxStatusEnum } from './enums';
import { users } from './identity';

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    link: varchar('link', { length: 500 }),
    data: jsonb('data').$type<Record<string, unknown>>(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    /** Notifications about the same thing collapse (e.g. "5 people liked your post"). */
    groupKey: varchar('group_key', { length: 120 }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_time_idx').on(t.userId, t.createdAt), index('notifications_user_unread_idx').on(t.userId).where(sql`${t.readAt} is null`)],
);

/** Per type × channel opt-in. Missing rows mean "use the default" (security is always on). */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.type, t.channel] })],
);

/** Browser Web Push (VAPID) subscriptions and Expo push tokens for the mobile app. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 10 }).notNull(), // web | expo
    endpoint: text('endpoint').notNull(), // web push endpoint URL or Expo push token
    keys: jsonb('keys').$type<{ p256dh: string; auth: string }>(),
    userAgent: text('user_agent'),
    failureCount: smallint('failure_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('push_subscriptions_endpoint_unique').on(t.endpoint), index('push_subscriptions_user_idx').on(t.userId)],
);

/**
 * Email/SMS outbox. Messages are written in the same transaction as the event that causes them and
 * delivered by a worker with retries; the log driver in development makes OTPs visible here.
 */
export const outboundMessages = pgTable(
  'outbound_messages',
  {
    id: id(),
    channel: varchar('channel', { length: 10 }).notNull(), // email | sms
    recipient: varchar('recipient', { length: 254 }).notNull(),
    subject: varchar('subject', { length: 200 }),
    body: text('body').notNull(),
    html: text('html'),
    template: varchar('template', { length: 60 }),
    status: outboxStatusEnum('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    sendAfter: timestamp('send_after', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('outbound_messages_queue_idx').on(t.status, t.sendAfter), index('outbound_messages_recipient_idx').on(t.recipient, t.createdAt)],
);
