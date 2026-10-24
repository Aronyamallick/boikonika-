import { sql } from 'drizzle-orm';
import { char, check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, timestamps } from './_columns';
import { kycDocumentTypeEnum, kycPurposeEnum, kycStatusEnum, roleKeyEnum } from './enums';
import { users } from './identity';

/**
 * Identity verification requests (seller, author, publisher, student, teacher, institution).
 * Status flow: pending → under_review → approved | rejected | resubmission_required → (new submission).
 */
export const kycVerifications = pgTable(
  'kyc_verifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: kycPurposeEnum('purpose').notNull(),
    /** Role granted on approval (a seller purpose can mean book_seller or general_seller). */
    requestedRole: roleKeyEnum('requested_role').notNull(),
    status: kycStatusEnum('status').notNull().default('pending'),
    legalName: varchar('legal_name', { length: 160 }).notNull(),
    dateOfBirth: date('date_of_birth'),
    businessName: varchar('business_name', { length: 200 }),
    institutionName: varchar('institution_name', { length: 200 }),
    address: text('address'),
    /** Declarations the applicant accepted (ownership / authorization / accuracy). */
    declarations: jsonb('declarations').$type<Record<string, boolean>>().notNull().default(sql`'{}'::jsonb`),
    reviewerId: uuid('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
    reviewNote: text('review_note'),
    rejectionReason: text('rejection_reason'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    reviewStartedAt: timestamp('review_started_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    /** Documents are purged after this date (retention policy) — set when a decision is made. */
    retentionUntil: timestamp('retention_until', { withTimezone: true }),
    previousVerificationId: uuid('previous_verification_id'),
    ...timestamps(),
  },
  (t) => [
    index('kyc_verifications_user_idx').on(t.userId, t.purpose),
    index('kyc_verifications_status_idx').on(t.status, t.submittedAt),
    // Only one open (not yet decided) verification per user and purpose.
    uniqueIndex('kyc_verifications_open_unique')
      .on(t.userId, t.purpose)
      .where(sql`${t.status} in ('pending','under_review')`),
  ],
);

/**
 * Uploaded identity documents. Files live in the PRIVATE bucket (never public URLs); the document
 * number is AES-256-GCM encrypted and only its last 4 characters are kept in clear for display.
 */
export const kycDocuments = pgTable(
  'kyc_documents',
  {
    id: id(),
    verificationId: uuid('verification_id')
      .notNull()
      .references(() => kycVerifications.id, { onDelete: 'cascade' }),
    type: kycDocumentTypeEnum('type').notNull(),
    side: varchar('side', { length: 10 }).notNull().default('front'), // front | back | single
    storageKey: text('storage_key').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: char('sha256', { length: 64 }).notNull(),
    documentNumberEnc: text('document_number_enc'),
    documentNumberLast4: varchar('document_number_last4', { length: 4 }),
    expiresOn: date('expires_on'),
    purgedAt: timestamp('purged_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('kyc_documents_verification_idx').on(t.verificationId), check('kyc_documents_size_positive', sql`${t.sizeBytes} > 0`)],
);

/** Append-only audit trail of every KYC status change and every document view. */
export const kycEvents = pgTable(
  'kyc_events',
  {
    id: id(),
    verificationId: uuid('verification_id')
      .notNull()
      .references(() => kycVerifications.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    event: varchar('event', { length: 40 }).notNull(), // submitted | review_started | approved | rejected | resubmission_requested | document_viewed | documents_purged
    fromStatus: kycStatusEnum('from_status'),
    toStatus: kycStatusEnum('to_status'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('kyc_events_verification_idx').on(t.verificationId, t.createdAt)],
);
