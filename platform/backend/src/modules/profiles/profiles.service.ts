import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  follows,
  kycVerifications,
  loginEvents,
  notificationPreferences,
  oauthAccounts,
  sessions,
  twoFactorRecoveryCodes,
  userBlocks,
  userInterests,
  userProfiles,
  userRoles,
  users,
  type Database,
} from '@boikonika/database';
import type { InterestKey, Visibility } from '@boikonika/shared';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { updateProfileSchema } from '@boikonika/shared';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { processUpload } from '../../infra/storage/uploads';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { SessionsService } from '../auth/sessions.service';
import { RecommendationsService } from '../catalog/recommendations.service';
import { RbacService } from '../rbac/rbac.service';
import { AccountDataService } from './account-data.service';

type UpdateProfile = z.output<typeof updateProfileSchema>;

/** Roles shown publicly as badges on a profile (others, e.g. staff roles, stay private). */
const PUBLIC_ROLES = ['author', 'publisher', 'teacher', 'student', 'book_seller', 'general_seller', 'institution'];

@Injectable()
export class ProfilesService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly rbac: RbacService,
    private readonly accountData: AccountDataService,
    private readonly recommendations: RecommendationsService,
  ) {}

  onModuleInit(): void {
    this.accountData.register('account', async (userId) => {
      const [user] = await this.db
        .select({ id: users.id, username: users.username, displayName: users.displayName, email: users.email, phone: users.phone, locale: users.locale, theme: users.theme, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt, twoFactorEnabled: sql<boolean>`${users.twoFactorEnabledAt} is not null` })
        .from(users)
        .where(eq(users.id, userId));
      return user;
    });
    this.accountData.register('profile', async (userId) => (await this.db.select().from(userProfiles).where(eq(userProfiles.userId, userId)))[0] ?? null);
    this.accountData.register('roles', async (userId) => this.rbac.rolesOf(userId));
    this.accountData.register('interests', async (userId) => (await this.db.select({ interest: userInterests.interest }).from(userInterests).where(eq(userInterests.userId, userId))).map((r) => r.interest));
    this.accountData.register('following', async (userId) => this.db.select({ targetType: follows.targetType, targetId: follows.targetId, since: follows.createdAt }).from(follows).where(eq(follows.followerId, userId)));
    this.accountData.register('devices', async (userId) => this.db.select({ deviceName: sessions.deviceName, platform: sessions.platform, createdAt: sessions.createdAt, lastUsedAt: sessions.lastUsedAt, revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.userId, userId)));
    this.accountData.register('signIns', async (userId) => this.db.select({ result: loginEvents.result, method: loginEvents.method, ip: loginEvents.ip, at: loginEvents.createdAt }).from(loginEvents).where(eq(loginEvents.userId, userId)).orderBy(desc(loginEvents.createdAt)).limit(500));
    this.accountData.register('notificationPreferences', async (userId) => this.db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)));
    this.accountData.register('verifications', async (userId) =>
      this.db.select({ purpose: kycVerifications.purpose, status: kycVerifications.status, submittedAt: kycVerifications.submittedAt, decidedAt: kycVerifications.decidedAt }).from(kycVerifications).where(eq(kycVerifications.userId, userId)),
    );
  }

  async getOwn(userId: string) {
    const [row] = await this.db
      .select({ user: users, profile: userProfiles })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.id, userId));
    if (!row) throw AppException.notFound('User');
    const interests = await this.db.select({ interest: userInterests.interest }).from(userInterests).where(eq(userInterests.userId, userId));
    const { profile, user } = row;
    return {
      displayName: user.displayName,
      username: user.username,
      locale: user.locale,
      theme: user.theme,
      personalizationEnabled: user.personalizationEnabled,
      onboarded: !!user.onboardedAt,
      avatarUrl: this.storage.publicUrl(profile.avatarKey),
      coverUrl: this.storage.publicUrl(profile.coverKey),
      bio: profile.bio,
      education: profile.education,
      institution: profile.institution,
      location: profile.location,
      website: profile.website,
      birthYear: profile.birthYear,
      profileVisibility: profile.profileVisibility,
      readingStatsVisibility: profile.readingStatsVisibility,
      libraryVisibility: profile.libraryVisibility,
      activityVisibility: profile.activityVisibility,
      interests: interests.map((i) => i.interest),
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
    };
  }

  async update(userId: string, input: UpdateProfile) {
    const { displayName, locale, theme, personalizationEnabled, ...profileFields } = input;
    await this.db.transaction(async (tx) => {
      const userChanges = Object.fromEntries(Object.entries({ displayName, locale, theme, personalizationEnabled }).filter(([, v]) => v !== undefined));
      if (Object.keys(userChanges).length) await tx.update(users).set(userChanges).where(eq(users.id, userId));
      const profileChanges = Object.fromEntries(Object.entries(profileFields).filter(([, v]) => v !== undefined));
      if (Object.keys(profileChanges).length) await tx.update(userProfiles).set(profileChanges).where(eq(userProfiles.userId, userId));
    });
    // Switching personalisation off also forgets the searches it would have used.
    if (personalizationEnabled === false) await this.recommendations.clearSearchHistory(userId);
    return this.getOwn(userId);
  }

  async setImage(userId: string, kind: 'avatar' | 'cover', file: Buffer) {
    const processed = await processUpload(file, {
      allowed: ['image/jpeg', 'image/png', 'image/webp'],
      maxBytes: 5 * 1024 * 1024,
      image: kind === 'avatar' ? { maxWidth: 512, maxHeight: 512, format: 'webp', crop: true } : { maxWidth: 1600, maxHeight: 600, format: 'webp', crop: true },
    });
    const key = `${kind}s/${userId}/${randomUUID()}.${processed.extension}`;
    await this.storage.put('public', key, processed.body, processed.contentType);
    const column = kind === 'avatar' ? userProfiles.avatarKey : userProfiles.coverKey;
    const [previous] = await this.db.select({ key: column }).from(userProfiles).where(eq(userProfiles.userId, userId));
    await this.db.update(userProfiles).set(kind === 'avatar' ? { avatarKey: key } : { coverKey: key }).where(eq(userProfiles.userId, userId));
    if (previous?.key) await this.storage.delete('public', previous.key);
    return { url: this.storage.publicUrl(key) };
  }

  async removeImage(userId: string, kind: 'avatar' | 'cover'): Promise<void> {
    const column = kind === 'avatar' ? userProfiles.avatarKey : userProfiles.coverKey;
    const [previous] = await this.db.select({ key: column }).from(userProfiles).where(eq(userProfiles.userId, userId));
    await this.db.update(userProfiles).set(kind === 'avatar' ? { avatarKey: null } : { coverKey: null }).where(eq(userProfiles.userId, userId));
    if (previous?.key) await this.storage.delete('public', previous.key);
  }

  /** Onboarding: replaces the reader's interests (used for recommendations) and marks onboarding done. */
  async setInterests(userId: string, interests: InterestKey[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(userInterests).where(eq(userInterests.userId, userId));
      if (interests.length) await tx.insert(userInterests).values(interests.map((interest) => ({ userId, interest, weight: 3 })));
      await tx.update(userProfiles).set({ favoriteGenres: interests }).where(eq(userProfiles.userId, userId));
      await tx.update(users).set({ onboardedAt: sql`coalesce(${users.onboardedAt}, now())` }).where(eq(users.id, userId));
    });
    return { interests };
  }

  // ------------------------------------------------------------- public profiles

  async publicProfile(username: string, viewerId?: string) {
    const [row] = await this.db
      .select({ user: users, profile: userProfiles })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(and(eq(users.username, username.toLowerCase()), sql`${users.deletedAt} is null`, eq(users.status, 'active')));
    if (!row) throw AppException.notFound('User');
    const { user, profile } = row;
    const relation = await this.relation(viewerId, user.id);
    if (relation.blockedByThem) throw AppException.notFound('User');
    const canSee = (visibility: Visibility) => relation.self || visibility === 'public' || (visibility === 'followers' && relation.following);
    const roles = (await this.rbac.rolesOf(user.id)).filter((r) => PUBLIC_ROLES.includes(r));
    const full = canSee(profile.profileVisibility);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: this.storage.publicUrl(profile.avatarKey),
      coverUrl: full ? this.storage.publicUrl(profile.coverKey) : null,
      roles,
      bio: full ? profile.bio : null,
      education: full ? profile.education : null,
      institution: full ? profile.institution : null,
      location: full ? profile.location : null,
      website: full ? profile.website : null,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      joinedAt: user.createdAt.toISOString(),
      visibility: { profile: full, readingStats: canSee(profile.readingStatsVisibility), library: canSee(profile.libraryVisibility), activity: canSee(profile.activityVisibility) },
      viewer: { self: relation.self, following: relation.following, blocked: relation.blockedByMe, signedIn: !!viewerId },
    };
  }

  async follow(viewerId: string, username: string): Promise<{ following: boolean; followerCount: number }> {
    const target = await this.activeUser(username);
    if (target.id === viewerId) throw AppException.badRequest('errors.forbidden');
    const relation = await this.relation(viewerId, target.id);
    // Being blocked looks like the account does not exist; your own block is reported as such.
    if (relation.blockedByThem) throw AppException.notFound('User');
    if (relation.blockedByMe) throw AppException.forbidden();
    return this.db.transaction(async (tx) => {
      const inserted = await tx.insert(follows).values({ followerId: viewerId, targetType: 'user', targetId: target.id }).onConflictDoNothing().returning({ id: follows.targetId });
      if (inserted.length) {
        await tx.update(userProfiles).set({ followerCount: sql`${userProfiles.followerCount} + 1` }).where(eq(userProfiles.userId, target.id));
        await tx.update(userProfiles).set({ followingCount: sql`${userProfiles.followingCount} + 1` }).where(eq(userProfiles.userId, viewerId));
      }
      const [counts] = await tx.select({ followerCount: userProfiles.followerCount }).from(userProfiles).where(eq(userProfiles.userId, target.id));
      return { following: true, followerCount: counts!.followerCount };
    });
  }

  async unfollow(viewerId: string, username: string): Promise<{ following: boolean; followerCount: number }> {
    const target = await this.activeUser(username);
    return this.db.transaction(async (tx) => {
      await this.removeFollow(tx, viewerId, target.id);
      const [counts] = await tx.select({ followerCount: userProfiles.followerCount }).from(userProfiles).where(eq(userProfiles.userId, target.id));
      return { following: false, followerCount: counts!.followerCount };
    });
  }

  /** Blocking also removes follows in both directions. */
  async block(viewerId: string, username: string): Promise<void> {
    const target = await this.activeUser(username);
    if (target.id === viewerId) throw AppException.badRequest('errors.forbidden');
    await this.db.transaction(async (tx) => {
      await tx.insert(userBlocks).values({ blockerId: viewerId, blockedId: target.id }).onConflictDoNothing();
      await this.removeFollow(tx, viewerId, target.id);
      await this.removeFollow(tx, target.id, viewerId);
    });
  }

  async unblock(viewerId: string, username: string): Promise<void> {
    const target = await this.activeUser(username);
    await this.db.delete(userBlocks).where(and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, target.id)));
  }

  async followers(username: string, viewerId: string | undefined, direction: 'followers' | 'following', limit: number, offset: number) {
    const target = await this.activeUser(username);
    const profile = await this.publicProfile(username, viewerId);
    if (!profile.visibility.profile) throw AppException.forbidden();
    const rows = await this.db
      .select({ username: users.username, displayName: users.displayName, avatarKey: userProfiles.avatarKey })
      .from(follows)
      .innerJoin(users, eq(users.id, direction === 'followers' ? follows.followerId : follows.targetId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(and(eq(follows.targetType, 'user'), eq(direction === 'followers' ? follows.targetId : follows.followerId, target.id), sql`${users.deletedAt} is null`))
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => ({ username: r.username, displayName: r.displayName, avatarUrl: this.storage.publicUrl(r.avatarKey) }));
  }

  // ------------------------------------------------------------- account deletion

  /**
   * Deletes the account: personal data is removed or anonymised, every session ends and sign-in is
   * no longer possible. Orders and payments stay (accounting law) but no longer identify the person;
   * public contributions remain under "Deleted user".
   */
  async deleteAccount(userId: string, password: string | undefined): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user || user.deletedAt) throw AppException.notFound('User');
    if (user.passwordHash && !(await this.passwords.verify(user.passwordHash, password ?? ''))) {
      throw new AppException('BAD_REQUEST', 'api.auth.wrongPassword', [{ field: 'password', code: 'invalid', message: 'api.auth.wrongPassword' }]);
    }
    const [profile] = await this.db.select({ avatarKey: userProfiles.avatarKey, coverKey: userProfiles.coverKey }).from(userProfiles).where(eq(userProfiles.userId, userId));
    const tag = userId.replace(/-/g, '').slice(0, 12);
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          status: 'deleted',
          deletedAt: new Date(),
          // Contact columns keep the "email or phone" rule satisfied without identifying anyone.
          email: `deleted-${tag}@deleted.invalid`,
          phone: null,
          username: `deleted_${tag}`,
          displayName: 'Deleted user',
          passwordHash: null,
          twoFactorSecretEnc: null,
          twoFactorEnabledAt: null,
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          personalizationEnabled: false,
        })
        .where(eq(users.id, userId));
      await tx
        .update(userProfiles)
        .set({ avatarKey: null, coverKey: null, bio: null, education: null, institution: null, location: null, website: null, birthYear: null, favoriteGenres: [], favoriteAuthorIds: [], profileVisibility: 'private' })
        .where(eq(userProfiles.userId, userId));
      await tx.delete(oauthAccounts).where(eq(oauthAccounts.userId, userId));
      await tx.delete(twoFactorRecoveryCodes).where(eq(twoFactorRecoveryCodes.userId, userId));
      await tx.delete(userInterests).where(eq(userInterests.userId, userId));
      await tx.delete(follows).where(or(eq(follows.followerId, userId), and(eq(follows.targetType, 'user'), eq(follows.targetId, userId))));
      await tx.delete(userRoles).where(and(eq(userRoles.userId, userId), inArray(userRoles.role, ['customer', 'student'])));
      await this.audit.record({ action: 'user.delete', entityType: 'user', entityId: userId, actorId: userId }, tx);
    });
    await this.sessions.revokeAll(userId, 'account_deleted');
    await this.rbac.invalidateUser(userId);
    await this.recommendations.clearSearchHistory(userId);
    for (const key of [profile?.avatarKey, profile?.coverKey]) if (key) await this.storage.delete('public', key);
  }

  private async removeFollow(tx: Parameters<Parameters<Database['transaction']>[0]>[0], followerId: string, targetId: string): Promise<void> {
    const removed = await tx
      .delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.targetType, 'user'), eq(follows.targetId, targetId)))
      .returning({ id: follows.targetId });
    if (removed.length) {
      await tx.update(userProfiles).set({ followerCount: sql`greatest(${userProfiles.followerCount} - 1, 0)` }).where(eq(userProfiles.userId, targetId));
      await tx.update(userProfiles).set({ followingCount: sql`greatest(${userProfiles.followingCount} - 1, 0)` }).where(eq(userProfiles.userId, followerId));
    }
  }

  private async activeUser(username: string) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, username.toLowerCase()), sql`${users.deletedAt} is null`, eq(users.status, 'active')));
    if (!user) throw AppException.notFound('User');
    return user;
  }

  private async relation(viewerId: string | undefined, targetId: string) {
    if (!viewerId) return { self: false, following: false, blockedByMe: false, blockedByThem: false };
    if (viewerId === targetId) return { self: true, following: false, blockedByMe: false, blockedByThem: false };
    const [result] = await this.db.execute<{ following: boolean; blocked_by_me: boolean; blocked_by_them: boolean }>(sql`
      select
        exists(select 1 from follows where follower_id = ${viewerId} and target_type = 'user' and target_id = ${targetId}) as following,
        exists(select 1 from user_blocks where blocker_id = ${viewerId} and blocked_id = ${targetId}) as blocked_by_me,
        exists(select 1 from user_blocks where blocker_id = ${targetId} and blocked_id = ${viewerId}) as blocked_by_them`).then((r) => r.rows);
    return { self: false, following: !!result?.following, blockedByMe: !!result?.blocked_by_me, blockedByThem: !!result?.blocked_by_them };
  }
}
