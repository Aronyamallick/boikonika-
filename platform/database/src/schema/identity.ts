import { sql } from 'drizzle-orm';
import { boolean, check, date, index, inet, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { citext, createdAt, id, timestamps } from './_columns';
import { loginResultEnum, otpPurposeEnum, roleKeyEnum, userStatusEnum, visibilityEnum } from './enums';

/**
 * One centralized account per person. Email and phone are both optional but at least one is
 * required; passwords are Argon2id hashes. Roles are assigned through user_roles (many).
 */
export const users = pgTable(
  'users',
  {
    id: id(),
    email: citext('email'),
    phone: varchar('phone', { length: 16 }), // E.164, e.g. +8801712345678
    username: citext('username').notNull(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    passwordHash: text('password_hash'),
    status: userStatusEnum('status').notNull().default('active'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    /** AES-256-GCM encrypted TOTP secret; null when 2FA is off. */
    twoFactorSecretEnc: text('two_factor_secret_enc'),
    twoFactorEnabledAt: timestamp('two_factor_enabled_at', { withTimezone: true }),
    locale: varchar('locale', { length: 5 }).notNull().default('bn'),
    theme: varchar('theme', { length: 10 }).notNull().default('system'),
    /** Users can switch off personalised recommendations (privacy control). */
    personalizationEnabled: boolean('personalization_enabled').notNull().default(true),
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    failedLoginCount: smallint('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    suspendedUntil: timestamp('suspended_until', { withTimezone: true }),
    statusReason: text('status_reason'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email).where(sql`${t.email} is not null and ${t.deletedAt} is null`),
    uniqueIndex('users_phone_unique').on(t.phone).where(sql`${t.phone} is not null and ${t.deletedAt} is null`),
    uniqueIndex('users_username_unique').on(t.username),
    index('users_status_idx').on(t.status),
    index('users_created_at_idx').on(t.createdAt),
    check('users_contact_required', sql`${t.email} is not null or ${t.phone} is not null`),
    check('users_phone_format', sql`${t.phone} is null or ${t.phone} ~ '^\\+8801[3-9][0-9]{8}$'`),
    check('users_username_format', sql`${t.username} ~ '^[A-Za-z0-9._]{3,30}$'`),
  ],
);

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  avatarKey: text('avatar_key'),
  coverKey: text('cover_key'),
  bio: varchar('bio', { length: 600 }),
  education: varchar('education', { length: 200 }),
  institution: varchar('institution', { length: 200 }),
  location: varchar('location', { length: 120 }),
  website: varchar('website', { length: 300 }),
  birthYear: smallint('birth_year'),
  favoriteGenres: text('favorite_genres').array().notNull().default(sql`'{}'::text[]`),
  favoriteAuthorIds: uuid('favorite_author_ids').array().notNull().default(sql`'{}'::uuid[]`),
  profileVisibility: visibilityEnum('profile_visibility').notNull().default('public'),
  readingStatsVisibility: visibilityEnum('reading_stats_visibility').notNull().default('followers'),
  libraryVisibility: visibilityEnum('library_visibility').notNull().default('followers'),
  activityVisibility: visibilityEnum('activity_visibility').notNull().default('followers'),
  followerCount: integer('follower_count').notNull().default(0),
  followingCount: integer('following_count').notNull().default(0),
  ...timestamps(),
});

export const roles = pgTable('roles', {
  key: roleKeyEnum('key').primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  description: text('description'),
  isStaff: boolean('is_staff').notNull().default(false),
  createdAt: createdAt(),
});

export const permissions = pgTable('permissions', {
  key: varchar('key', { length: 80 }).primaryKey(), // e.g. "users.ban"
  description: text('description').notNull(),
  createdAt: createdAt(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    role: roleKeyEnum('role')
      .notNull()
      .references(() => roles.key, { onDelete: 'cascade' }),
    permission: varchar('permission', { length: 80 })
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.role, t.permission] })],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleKeyEnum('role')
      .notNull()
      .references(() => roles.key),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] }), index('user_roles_role_idx').on(t.role)],
);

/** Direct grants (or explicit denials) on top of role permissions. */
export const userPermissions = pgTable(
  'user_permissions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: varchar('permission', { length: 80 })
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
    granted: boolean('granted').notNull().default(true),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.permission] })],
);

/**
 * Refresh-token sessions (one per signed-in device). Only a SHA-256 hash of the refresh token is
 * stored; tokens rotate on every refresh and reuse of a rotated token revokes the whole family.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 64 }).notNull(),
    previousTokenHash: varchar('previous_token_hash', { length: 64 }),
    familyId: uuid('family_id').notNull(),
    deviceName: varchar('device_name', { length: 160 }),
    platform: varchar('platform', { length: 20 }).notNull().default('web'), // web | android | ios
    userAgent: text('user_agent'),
    ip: inet('ip'),
    deviceFingerprint: varchar('device_fingerprint', { length: 64 }),
    twoFactorVerified: boolean('two_factor_verified').notNull().default(false),
    /** "Keep me signed in": long-lived cookie and 30-day sliding expiry; otherwise 12 hours. */
    persistent: boolean('persistent').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: varchar('revoked_reason', { length: 40 }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_refresh_token_hash_unique').on(t.refreshTokenHash),
    index('sessions_user_active_idx').on(t.userId).where(sql`${t.revokedAt} is null`),
    index('sessions_previous_token_hash_idx').on(t.previousTokenHash),
  ],
);

export const loginEvents = pgTable(
  'login_events',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    identifier: varchar('identifier', { length: 254 }),
    result: loginResultEnum('result').notNull(),
    method: varchar('method', { length: 20 }).notNull().default('password'), // password | otp | google | refresh
    ip: inet('ip'),
    userAgent: text('user_agent'),
    deviceFingerprint: varchar('device_fingerprint', { length: 64 }),
    suspicious: boolean('suspicious').notNull().default(false),
    suspiciousReasons: text('suspicious_reasons').array(),
    createdAt: createdAt(),
  },
  (t) => [index('login_events_user_created_idx').on(t.userId, t.createdAt), index('login_events_ip_created_idx').on(t.ip, t.createdAt)],
);

/** One-time codes for phone/email verification, OTP login and password reset (hash only). */
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: id(),
    purpose: otpPurposeEnum('purpose').notNull(),
    target: varchar('target', { length: 254 }).notNull(), // normalised email or E.164 phone
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    attempts: smallint('attempts').notNull().default(0),
    maxAttempts: smallint('max_attempts').notNull().default(5),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    ip: inet('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('otp_codes_target_purpose_idx').on(t.target, t.purpose, t.createdAt)],
);

/** Opaque single-use tokens sent in links (email verification). */
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: varchar('purpose', { length: 30 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    target: varchar('target', { length: 254 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('verification_tokens_token_hash_unique').on(t.tokenHash)],
);

export const twoFactorRecoveryCodes = pgTable(
  'two_factor_recovery_codes',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('two_factor_recovery_codes_user_idx').on(t.userId)],
);

/** Social login links (Google today; Facebook/Apple use the same table). */
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 20 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 191 }).notNull(),
    email: citext('email'),
    profile: jsonb('profile').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('oauth_accounts_provider_account_unique').on(t.provider, t.providerAccountId), index('oauth_accounts_user_idx').on(t.userId)],
);

/** Onboarding interests (genre/topic keys) used for discovery and recommendations. */
export const userInterests = pgTable(
  'user_interests',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    interest: varchar('interest', { length: 40 }).notNull(),
    weight: smallint('weight').notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.interest] }), index('user_interests_interest_idx').on(t.interest)],
);

/** Follows: user → user, author, publisher or store (polymorphic, validated by the API). */
export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 20 }).notNull(), // user | author | publisher | store
    targetId: uuid('target_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.targetType, t.targetId] }),
    index('follows_target_idx').on(t.targetType, t.targetId),
    check('follows_target_type_valid', sql`${t.targetType} in ('user','author','publisher','store')`),
  ],
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), check('user_blocks_not_self', sql`${t.blockerId} <> ${t.blockedId}`)],
);

/** Account restrictions from moderation (temporary or permanent, per capability). */
export const userRestrictions = pgTable(
  'user_restrictions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: varchar('scope', { length: 20 }).notNull(), // post | comment | review | sell | message | all
    reason: text('reason'),
    until: timestamp('until', { withTimezone: true }),
    actionId: uuid('action_id'),
    liftedAt: timestamp('lifted_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('user_restrictions_user_idx').on(t.userId)],
);

/** Daily active-user rollup (one row per user per day) for DAU/MAU without storing raw pageviews forever. */
export const userActivityDays = pgTable(
  'user_activity_days',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    platform: varchar('platform', { length: 20 }).notNull().default('web'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] }), index('user_activity_days_day_idx').on(t.day)],
);
