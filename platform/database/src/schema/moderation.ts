import { sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, timestamps } from './_columns';
import { copyrightClaimStatusEnum, moderationActionEnum, reportReasonEnum, reportStatusEnum } from './enums';
import { users } from './identity';

export const REPORT_TARGETS = ['post', 'comment', 'review', 'product', 'book', 'user', 'club', 'club_post', 'store'] as const;

/** User reports. Workflow: reported → under_review → action_taken → resolved (or dismissed). */
export const reports = pgTable(
  'reports',
  {
    id: id(),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: varchar('target_type', { length: 20 }).notNull(),
    targetId: uuid('target_id').notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    reason: reportReasonEnum('reason').notNull(),
    details: text('details'),
    status: reportStatusEnum('status').notNull().default('reported'),
    priority: varchar('priority', { length: 10 }).notNull().default('normal'), // normal | high (student zone, scams)
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    resolutionNote: text('resolution_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('reports_queue_idx').on(t.status, t.priority, t.createdAt),
    index('reports_target_idx').on(t.targetType, t.targetId),
    check('reports_target_type_valid', sql`${t.targetType} in ('post','comment','review','product','book','user','club','club_post','store')`),
  ],
);

/** Every moderation decision (warning → ban), with optional expiry for temporary restrictions. */
export const moderationActions = pgTable(
  'moderation_actions',
  {
    id: id(),
    reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),
    targetType: varchar('target_type', { length: 20 }).notNull(),
    targetId: uuid('target_id').notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: moderationActionEnum('action').notNull(),
    reason: text('reason').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    revertedAt: timestamp('reverted_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('moderation_actions_target_user_idx').on(t.targetUserId, t.createdAt), index('moderation_actions_target_idx').on(t.targetType, t.targetId)],
);

/**
 * Copyright complaints (takedown) and counter-notifications. A valid claim removes the content;
 * a counter-notice can restore it after review.
 */
export const copyrightClaims = pgTable(
  'copyright_claims',
  {
    id: id(),
    claimantUserId: uuid('claimant_user_id').references(() => users.id, { onDelete: 'set null' }),
    claimantName: varchar('claimant_name', { length: 160 }).notNull(),
    claimantEmail: varchar('claimant_email', { length: 254 }).notNull(),
    claimantPhone: varchar('claimant_phone', { length: 20 }),
    rightsHolder: varchar('rights_holder', { length: 200 }).notNull(),
    workDescription: text('work_description').notNull(),
    targetType: varchar('target_type', { length: 20 }).notNull(), // product | book | preview | digital_asset | post
    targetId: uuid('target_id').notNull(),
    evidenceUrls: text('evidence_urls').array(),
    goodFaithStatement: boolean('good_faith_statement').notNull(),
    accuracyStatement: boolean('accuracy_statement').notNull(),
    signature: varchar('signature', { length: 160 }).notNull(),
    status: copyrightClaimStatusEnum('status').notNull().default('submitted'),
    respondentUserId: uuid('respondent_user_id').references(() => users.id, { onDelete: 'set null' }),
    counterStatement: text('counter_statement'),
    counterSignature: varchar('counter_signature', { length: 160 }),
    counterSubmittedAt: timestamp('counter_submitted_at', { withTimezone: true }),
    adminNote: text('admin_note'),
    handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  (t) => [
    index('copyright_claims_status_idx').on(t.status, t.createdAt),
    index('copyright_claims_target_idx').on(t.targetType, t.targetId),
    check('copyright_claims_statements_required', sql`${t.goodFaithStatement} and ${t.accuracyStatement}`),
  ],
);
