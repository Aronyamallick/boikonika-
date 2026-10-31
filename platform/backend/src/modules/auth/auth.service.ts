import { Inject, Injectable } from '@nestjs/common';
import { loginEvents, oauthAccounts, sessions, twoFactorRecoveryCodes, userProfiles, userRoles, users, type Database, type DbOrTx } from '@boikonika/database';
import {
  isLocale,
  type AuthResult,
  type AuthUser,
  type Identifier,
  type Locale,
  type OtpRequestPurpose,
  type OtpSentResult,
  type TwoFactorChallenge,
} from '@boikonika/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { toString as qrToString } from 'qrcode';
import { requestContext } from '../../common/context/request-context';
import { AppException } from '../../common/errors/app-exception';
import { isUniqueViolation } from '../../common/errors/pg';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { CryptoService } from '../../infra/crypto/crypto.service';
import { DB } from '../../infra/database/database.module';
import { MessagesService, type Contact } from '../../infra/messaging/messages.service';
import { REDIS } from '../../infra/redis/redis.module';
import { StorageService } from '../../infra/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RbacService } from '../rbac/rbac.service';
import { GoogleIdTokenVerifier } from './google.verifier';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { SessionsService, type DeviceInfo, type SessionRow } from './sessions.service';
import { TokenService } from './token.service';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp';

type UserRow = typeof users.$inferSelect;

/** Everything a controller needs to finish a sign-in (the refresh token goes to a cookie or the body). */
export interface SignInOutcome {
  result: AuthResult;
  session: SessionRow;
  refreshToken: string;
}

const LOCK_AFTER_FAILURES = 5;
const BASE_LOCK_MINUTES = 15;
const MAX_LOCK_MINUTES = 24 * 60;
const MAX_CHALLENGE_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly crypto: CryptoService,
    private readonly passwords: PasswordService,
    private readonly otp: OtpService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokenService,
    private readonly google: GoogleIdTokenVerifier,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly messages: MessagesService,
    private readonly storage: StorageService,
  ) {}

  // ---------------------------------------------------------------- one-time codes

  async requestOtp(contact: Contact, purpose: OtpRequestPurpose, locale: Locale, currentUserId?: string): Promise<OtpSentResult> {
    if (purpose === 'verify_email' || purpose === 'verify_phone') {
      if (!currentUserId) throw new AppException('UNAUTHORIZED', 'errors.unauthorized');
      if ((purpose === 'verify_email') !== (contact.kind === 'email')) throw AppException.validation([{ field: 'target', code: 'invalid', message: 'validation.identifier' }]);
      const owner = await this.findByContact(contact);
      if (owner && owner.id !== currentUserId) throw new AppException('CONFLICT', 'api.auth.contactTaken', [{ field: 'target', code: 'taken', message: 'api.auth.contactTaken' }]);
      const result = await this.otp.reserve(purpose, contact);
      await this.otp.send(purpose, contact, locale, currentUserId);
      return result;
    }

    // Registration, login and reset respond identically whether or not an account exists.
    const result = await this.otp.reserve(purpose, contact);
    const user = await this.findByContact(contact);
    if (purpose === 'register') {
      if (user) await this.messages.sendAccountExists(contact, locale);
      else await this.otp.send('register', contact, locale);
    } else if (user && this.statusAllowsSignIn(user)) {
      await this.otp.send(purpose, contact, locale, user.id);
    }
    return result;
  }

  // ---------------------------------------------------------------- registration

  async register(input: {
    name: string;
    target: Contact;
    code: string;
    password: string;
    username?: string;
    isStudent: boolean;
    locale?: Locale;
    device: DeviceInfo;
  }): Promise<SignInOutcome> {
    const passwordHash = await this.passwords.hash(input.password);
    const locale = input.locale ?? requestContext.locale();
    const user = await this.db.transaction(async (tx) => {
      await this.otp.verify('register', input.target.value, input.code, tx);
      if (await this.findByContact(input.target, tx)) throw new AppException('CONFLICT', 'api.auth.contactTaken', [{ field: 'target', code: 'taken', message: 'api.auth.contactTaken' }]);
      const username = input.username ? input.username.toLowerCase() : await this.generateUsername(input.target, tx);
      if (input.username && (await this.usernameTaken(username, tx))) {
        throw new AppException('CONFLICT', 'api.auth.usernameTaken', [{ field: 'username', code: 'taken', message: 'api.auth.usernameTaken' }]);
      }
      const now = new Date();
      let created: UserRow;
      try {
        [created] = (await tx
          .insert(users)
          .values({
            username,
            displayName: input.name,
            passwordHash,
            locale,
            ...(input.target.kind === 'email' ? { email: input.target.value, emailVerifiedAt: now } : { phone: input.target.value, phoneVerifiedAt: now }),
          })
          .returning()) as [UserRow];
      } catch (error) {
        if (isUniqueViolation(error, 'users_username_unique')) throw new AppException('CONFLICT', 'api.auth.usernameTaken', [{ field: 'username', code: 'taken', message: 'api.auth.usernameTaken' }]);
        if (isUniqueViolation(error)) throw new AppException('CONFLICT', 'api.auth.contactTaken', [{ field: 'target', code: 'taken', message: 'api.auth.contactTaken' }]);
        throw error;
      }
      await tx.insert(userProfiles).values({ userId: created.id });
      await tx.insert(userRoles).values([{ userId: created.id, role: 'customer' as const }, ...(input.isStudent ? [{ userId: created.id, role: 'student' as const }] : [])]);
      await this.audit.record({ action: 'user.register', entityType: 'user', entityId: created.id, after: { username, via: input.target.kind }, actorId: created.id }, tx);
      return created;
    });
    return this.completeSignIn(user, 'register', input.device, false);
  }

  async usernameAvailable(username: string): Promise<boolean> {
    return !(await this.usernameTaken(username.toLowerCase()));
  }

  // ---------------------------------------------------------------- sign-in

  async login(identifier: Identifier, password: string, device: DeviceInfo): Promise<SignInOutcome | TwoFactorChallenge> {
    const user = await this.findByIdentifier(identifier);
    if (!user) {
      await this.passwords.burn(password);
      await this.recordLogin(null, identifier.value, 'failed_password', 'password', device);
      throw this.invalidCredentials();
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.recordLogin(user.id, identifier.value, 'locked', 'password', device);
      throw new AppException('RATE_LIMITED', 'api.auth.accountLocked', [], 429).withParams({ minutes: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000) });
    }
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      await this.registerFailure(user);
      await this.recordLogin(user.id, identifier.value, 'failed_password', 'password', device);
      throw this.invalidCredentials();
    }
    // Account status is only revealed to someone who knows the password.
    this.assertStatus(await this.refreshStatus(user), identifier.value);
    if (this.passwords.needsRehash(user.passwordHash!)) {
      await this.db.update(users).set({ passwordHash: await this.passwords.hash(password) }).where(eq(users.id, user.id));
    }
    return this.secondFactorOrComplete(user, 'password', device);
  }

  async loginWithOtp(target: Contact, code: string, device: DeviceInfo): Promise<SignInOutcome | TwoFactorChallenge> {
    const user = await this.findByContact(target);
    if (!user) throw new AppException('BAD_REQUEST', 'api.auth.otpInvalid', [{ field: 'code', code: 'otp_invalid', message: 'api.auth.otpInvalid' }]);
    await this.otp.verify('login', target.value, code);
    this.assertStatus(await this.refreshStatus(user), target.value);
    return this.secondFactorOrComplete(user, 'otp', device);
  }

  async loginWithGoogle(idToken: string, device: DeviceInfo, locale: Locale): Promise<SignInOutcome | TwoFactorChallenge> {
    const profile = await this.google.verify(idToken);
    const [link] = await this.db.select().from(oauthAccounts).where(and(eq(oauthAccounts.provider, 'google'), eq(oauthAccounts.providerAccountId, profile.sub))).limit(1);
    let user = link ? await this.getUser(link.userId) : await this.findByContact({ kind: 'email', value: profile.email });
    if (user && !link) {
      // Our emails are only stored after verification, and Google verified this address too.
      await this.db.insert(oauthAccounts).values({ userId: user.id, provider: 'google', providerAccountId: profile.sub, email: profile.email, profile: { name: profile.name } }).onConflictDoNothing();
      await this.audit.record({ action: 'user.oauth.link', entityType: 'user', entityId: user.id, after: { provider: 'google' }, actorId: user.id });
    }
    if (!user) {
      user = await this.db.transaction(async (tx) => {
        const [created] = (await tx
          .insert(users)
          .values({
            username: await this.generateUsername({ kind: 'email', value: profile.email }, tx),
            displayName: (profile.name ?? profile.email.split('@')[0]!).slice(0, 120),
            email: profile.email,
            emailVerifiedAt: new Date(),
            locale: profile.locale?.startsWith('en') ? 'en' : locale,
          })
          .returning()) as [UserRow];
        await tx.insert(userProfiles).values({ userId: created.id });
        await tx.insert(userRoles).values({ userId: created.id, role: 'customer' });
        await tx.insert(oauthAccounts).values({ userId: created.id, provider: 'google', providerAccountId: profile.sub, email: profile.email, profile: { name: profile.name } });
        await this.audit.record({ action: 'user.register', entityType: 'user', entityId: created.id, after: { via: 'google' }, actorId: created.id }, tx);
        return created;
      });
    }
    if (!user || user.deletedAt) throw new AppException('UNAUTHORIZED', 'api.auth.googleInvalid');
    this.assertStatus(await this.refreshStatus(user), profile.email);
    return this.secondFactorOrComplete(user, 'google', device);
  }

  async loginWithTwoFactor(challengeToken: string, code: string | undefined, recoveryCode: string | undefined): Promise<SignInOutcome> {
    const verified = this.tokens.verifyChallenge(challengeToken);
    if (!verified.ok) throw new AppException('UNAUTHORIZED', 'api.auth.twoFactorChallengeExpired');
    const { claims } = verified;
    if (await this.redis.exists(`2fa:used:${claims.jti}`)) throw new AppException('UNAUTHORIZED', 'api.auth.twoFactorChallengeExpired');
    const attempts = await this.redis.incr(`2fa:attempts:${claims.jti}`);
    await this.redis.expire(`2fa:attempts:${claims.jti}`, 600);
    if (attempts > MAX_CHALLENGE_ATTEMPTS) throw new AppException('UNAUTHORIZED', 'api.auth.twoFactorChallengeExpired');

    const user = await this.getUser(claims.sub);
    if (!user || !user.twoFactorSecretEnc) throw new AppException('UNAUTHORIZED', 'api.auth.twoFactorChallengeExpired');
    const device = { ...claims.device, client: claims.device.client as DeviceInfo['client'] };
    if (!(await this.checkSecondFactor(user, code, recoveryCode))) {
      await this.recordLogin(user.id, user.username, 'failed_2fa', claims.method, device);
      throw new AppException('BAD_REQUEST', 'api.auth.twoFactorInvalid', [{ field: code ? 'code' : 'recoveryCode', code: 'invalid', message: 'api.auth.twoFactorInvalid' }]);
    }
    // One challenge, one session.
    if (!(await this.redis.set(`2fa:used:${claims.jti}`, '1', 'EX', 600, 'NX'))) throw new AppException('UNAUTHORIZED', 'api.auth.twoFactorChallengeExpired');
    this.assertStatus(await this.refreshStatus(user), user.username);
    return this.completeSignIn(user, claims.method, device, true);
  }

  // ---------------------------------------------------------------- sessions

  async refresh(refreshToken: string): Promise<SignInOutcome> {
    const { session, refreshToken: next } = await this.sessions.rotate(refreshToken);
    const user = await this.getUser(session.userId);
    if (!user || !this.statusAllowsSignIn(await this.refreshStatus(user))) {
      await this.sessions.revoke(session.id, 'account_status');
      throw new AppException('UNAUTHORIZED', 'api.auth.sessionExpired');
    }
    const access = this.tokens.signAccess(user.id, session.id);
    return { result: { user: await this.presentUser(user), tokens: { accessToken: access.token, expiresIn: access.expiresIn } }, session, refreshToken: next };
  }

  async logout(sessionId: string | null, refreshToken: string | null): Promise<void> {
    let id = sessionId;
    if (!id && refreshToken) id = (await this.sessions.findByRefreshToken(refreshToken))?.id ?? null;
    if (id) await this.sessions.revoke(id, 'logout');
  }

  async logoutAll(userId: string, currentSessionId: string, keepCurrent: boolean): Promise<number> {
    const count = await this.sessions.revokeAll(userId, 'logout_all', keepCurrent ? currentSessionId : undefined);
    await this.audit.record({ action: 'user.sessions.revoke_all', entityType: 'user', entityId: userId, after: { count, keepCurrent } });
    return count;
  }

  async listSessions(userId: string, currentSessionId: string) {
    const rows = await this.sessions.listActive(userId);
    return rows.map((s) => ({
      id: s.id,
      deviceName: s.deviceName,
      platform: s.platform,
      ip: maskIp(s.ip),
      lastUsedAt: s.lastUsedAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      current: s.id === currentSessionId,
      twoFactorVerified: s.twoFactorVerified,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.get(sessionId);
    if (!session || session.userId !== userId || session.revokedAt) throw new AppException('NOT_FOUND', 'api.auth.sessionNotFound');
    await this.sessions.revoke(sessionId, 'revoked_by_user');
    await this.audit.record({ action: 'user.session.revoke', entityType: 'session', entityId: sessionId });
  }

  async loginHistory(userId: string, limit = 30) {
    const rows = await this.db
      .select({ id: loginEvents.id, result: loginEvents.result, method: loginEvents.method, ip: loginEvents.ip, userAgent: loginEvents.userAgent, suspicious: loginEvents.suspicious, createdAt: loginEvents.createdAt })
      .from(loginEvents)
      .where(eq(loginEvents.userId, userId))
      .orderBy(desc(loginEvents.createdAt))
      .limit(limit);
    return rows.map((r) => ({ ...r, ip: maskIp(r.ip), createdAt: r.createdAt.toISOString() }));
  }

  // ---------------------------------------------------------------- passwords

  async forgotPassword(target: Contact, locale: Locale): Promise<OtpSentResult> {
    return this.requestOtp(target, 'reset_password', locale);
  }

  async resetPassword(target: Contact, code: string, password: string): Promise<void> {
    const passwordHash = await this.passwords.hash(password);
    const userId = await this.db.transaction(async (tx) => {
      await this.otp.verify('reset_password', target.value, code, tx);
      const user = await this.findByContact(target, tx);
      if (!user) throw new AppException('BAD_REQUEST', 'api.auth.otpInvalid');
      await tx.update(users).set({ passwordHash, failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
      await this.audit.record({ action: 'user.password.reset', entityType: 'user', entityId: user.id, actorId: user.id }, tx);
      return user.id;
    });
    await this.sessions.revokeAll(userId, 'password_reset');
    await this.notifications.notify(userId, { type: 'security', titleKey: 'api.messages.passwordChangedTitle', bodyKey: 'api.messages.passwordChangedBody', params: { time: new Date() }, link: '/account/security' });
  }

  async changePassword(userId: string, sessionId: string, currentPassword: string | undefined, newPassword: string, signOutOthers: boolean): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) throw new AppException('UNAUTHORIZED', 'errors.unauthorized');
    if (user.passwordHash) {
      if (!currentPassword) throw new AppException('BAD_REQUEST', 'api.auth.passwordRequired', [{ field: 'currentPassword', code: 'required', message: 'api.auth.passwordRequired' }]);
      if (!(await this.passwords.verify(user.passwordHash, currentPassword))) {
        throw new AppException('BAD_REQUEST', 'api.auth.wrongPassword', [{ field: 'currentPassword', code: 'invalid', message: 'api.auth.wrongPassword' }]);
      }
      if (await this.passwords.verify(user.passwordHash, newPassword)) {
        throw new AppException('BAD_REQUEST', 'api.auth.samePassword', [{ field: 'newPassword', code: 'same', message: 'api.auth.samePassword' }]);
      }
    }
    await this.db.update(users).set({ passwordHash: await this.passwords.hash(newPassword) }).where(eq(users.id, userId));
    if (signOutOthers) await this.sessions.revokeAll(userId, 'password_change', sessionId);
    await this.audit.record({ action: 'user.password.change', entityType: 'user', entityId: userId, after: { signOutOthers } });
    await this.notifications.notify(userId, { type: 'security', titleKey: 'api.messages.passwordChangedTitle', bodyKey: 'api.messages.passwordChangedBody', params: { time: new Date() }, link: '/account/security' });
  }

  // ---------------------------------------------------------------- contacts

  async verifyContact(userId: string, target: Contact, code: string): Promise<AuthUser> {
    const purpose = target.kind === 'email' ? 'verify_email' : 'verify_phone';
    await this.db.transaction(async (tx) => {
      const { userId: owner } = await this.otp.verify(purpose, target.value, code, tx);
      if (owner !== userId) throw new AppException('BAD_REQUEST', 'api.auth.otpInvalid');
      try {
        await tx
          .update(users)
          .set(target.kind === 'email' ? { email: target.value, emailVerifiedAt: new Date() } : { phone: target.value, phoneVerifiedAt: new Date() })
          .where(eq(users.id, userId));
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppException('CONFLICT', 'api.auth.contactTaken', [{ field: 'target', code: 'taken', message: 'api.auth.contactTaken' }]);
        throw error;
      }
      await this.audit.record({ action: `user.${target.kind}.verify`, entityType: 'user', entityId: userId, after: { [target.kind]: target.value } }, tx);
    });
    return this.presentUser((await this.getUser(userId))!);
  }

  // ---------------------------------------------------------------- two-step verification

  async startTwoFactorSetup(userId: string): Promise<{ secret: string; otpauthUrl: string; qrSvg: string }> {
    const user = await this.getUser(userId);
    if (!user) throw new AppException('UNAUTHORIZED', 'errors.unauthorized');
    if (user.twoFactorEnabledAt) throw new AppException('CONFLICT', 'api.auth.twoFactorAlreadyEnabled');
    const secret = generateTotpSecret();
    await this.redis.set(`2fa:setup:${userId}`, this.crypto.encrypt(secret), 'EX', 600);
    const url = otpauthUrl(secret, user.email ?? user.phone ?? user.username);
    const qrSvg = await qrToString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0F172A', light: '#FFFFFF' } });
    return { secret, otpauthUrl: url, qrSvg };
  }

  async enableTwoFactor(userId: string, sessionId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const pending = await this.redis.get(`2fa:setup:${userId}`);
    if (!pending) throw new AppException('BAD_REQUEST', 'api.auth.twoFactorSetupMissing');
    const secret = this.crypto.decrypt(pending);
    const step = verifyTotp(secret, code);
    if (step === null) throw new AppException('BAD_REQUEST', 'api.auth.twoFactorInvalid', [{ field: 'code', code: 'invalid', message: 'api.auth.twoFactorInvalid' }]);
    const codes = this.newRecoveryCodes();
    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(users)
        .set({ twoFactorSecretEnc: this.crypto.encrypt(secret), twoFactorEnabledAt: new Date() })
        .where(and(eq(users.id, userId), isNull(users.twoFactorEnabledAt)))
        .returning({ id: users.id });
      if (!updated) throw new AppException('CONFLICT', 'api.auth.twoFactorAlreadyEnabled');
      await this.storeRecoveryCodes(tx, userId, codes);
      await tx.update(sessions).set({ twoFactorVerified: true }).where(eq(sessions.id, sessionId));
      await this.audit.record({ action: 'user.2fa.enable', entityType: 'user', entityId: userId }, tx);
    });
    await this.redis.multi().del(`2fa:setup:${userId}`).set(`2fa:step:${userId}`, String(step), 'EX', 120).exec();
    await this.notifications.notify(userId, { type: 'security', titleKey: 'api.messages.twoFactorEnabledTitle', bodyKey: 'api.messages.twoFactorEnabledBody', link: '/account/security' });
    return { recoveryCodes: codes };
  }

  async disableTwoFactor(userId: string, password: string | undefined, code: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user?.twoFactorSecretEnc) throw new AppException('BAD_REQUEST', 'api.auth.twoFactorNotEnabled');
    if (user.passwordHash && !(await this.passwords.verify(user.passwordHash, password ?? ''))) {
      throw new AppException('BAD_REQUEST', 'api.auth.wrongPassword', [{ field: 'password', code: 'invalid', message: 'api.auth.wrongPassword' }]);
    }
    if (!(await this.checkSecondFactor(user, code, undefined))) {
      throw new AppException('BAD_REQUEST', 'api.auth.twoFactorInvalid', [{ field: 'code', code: 'invalid', message: 'api.auth.twoFactorInvalid' }]);
    }
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ twoFactorSecretEnc: null, twoFactorEnabledAt: null }).where(eq(users.id, userId));
      await tx.delete(twoFactorRecoveryCodes).where(eq(twoFactorRecoveryCodes.userId, userId));
      await this.audit.record({ action: 'user.2fa.disable', entityType: 'user', entityId: userId }, tx);
    });
    await this.notifications.notify(userId, { type: 'security', titleKey: 'api.messages.twoFactorDisabledTitle', bodyKey: 'api.messages.twoFactorDisabledBody', params: { time: new Date() }, link: '/account/security' });
  }

  async regenerateRecoveryCodes(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.getUser(userId);
    if (!user?.twoFactorSecretEnc) throw new AppException('BAD_REQUEST', 'api.auth.twoFactorNotEnabled');
    if (!(await this.checkSecondFactor(user, code, undefined))) {
      throw new AppException('BAD_REQUEST', 'api.auth.twoFactorInvalid', [{ field: 'code', code: 'invalid', message: 'api.auth.twoFactorInvalid' }]);
    }
    const codes = this.newRecoveryCodes();
    await this.db.transaction(async (tx) => {
      await tx.delete(twoFactorRecoveryCodes).where(eq(twoFactorRecoveryCodes.userId, userId));
      await this.storeRecoveryCodes(tx, userId, codes);
      await this.audit.record({ action: 'user.2fa.recovery_codes.regenerate', entityType: 'user', entityId: userId }, tx);
    });
    return { recoveryCodes: codes };
  }

  // ---------------------------------------------------------------- the signed-in user

  async me(userId: string): Promise<AuthUser> {
    const user = await this.getUser(userId);
    if (!user || user.deletedAt) throw new AppException('UNAUTHORIZED', 'errors.unauthorized');
    return this.presentUser(user);
  }

  async presentUser(user: UserRow): Promise<AuthUser> {
    const [[profile], roles, permissions] = await Promise.all([
      this.db.select({ avatarKey: userProfiles.avatarKey }).from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1),
      this.rbac.rolesOf(user.id),
      this.rbac.permissionsOf(user.id),
    ]);
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      phone: user.phone,
      emailVerified: !!user.emailVerifiedAt,
      phoneVerified: !!user.phoneVerifiedAt,
      avatarUrl: this.storage.publicUrl(profile?.avatarKey),
      locale: user.locale,
      theme: user.theme,
      roles,
      permissions,
      twoFactorEnabled: !!user.twoFactorEnabledAt,
      hasPassword: !!user.passwordHash,
      onboarded: !!user.onboardedAt,
      personalizationEnabled: user.personalizationEnabled,
      createdAt: user.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------- internals

  private async secondFactorOrComplete(user: UserRow, method: string, device: DeviceInfo): Promise<SignInOutcome | TwoFactorChallenge> {
    if (user.twoFactorEnabledAt && user.twoFactorSecretEnc) {
      const challenge = this.tokens.signChallenge({ sub: user.id, method, device: { deviceName: device.deviceName, deviceId: device.deviceId, client: device.client, rememberDevice: device.rememberDevice } });
      return { twoFactorRequired: true, challengeToken: challenge.token, expiresIn: challenge.expiresIn };
    }
    return this.completeSignIn(user, method, device, false);
  }

  private async completeSignIn(user: UserRow, method: string, device: DeviceInfo, twoFactorVerified: boolean): Promise<SignInOutcome> {
    const fingerprint = device.deviceId ? this.crypto.sha256(`device:${device.deviceId}`) : null;
    const reasons = await this.suspicionReasons(user.id, fingerprint);
    const { session, refreshToken } = await this.sessions.create(user.id, device, twoFactorVerified);
    await this.db.update(users).set({ lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
    const suspicious = reasons.length === 2;
    await this.recordLogin(user.id, user.username, 'success', method, device, suspicious, reasons);
    if (suspicious) {
      await this.notifications.notify(user.id, {
        type: 'security',
        titleKey: 'api.messages.newSignInTitle',
        bodyKey: 'api.messages.newSignInBody',
        params: { device: session.deviceName ?? '—', ip: maskIp(session.ip) ?? '—', time: new Date() },
        link: '/account/security',
      });
    }
    const access = this.tokens.signAccess(user.id, session.id);
    return { result: { user: await this.presentUser(user), tokens: { accessToken: access.token, expiresIn: access.expiresIn } }, session, refreshToken };
  }

  /** New device *and* new network compared with this user's earlier successful sign-ins. */
  private async suspicionReasons(userId: string, fingerprint: string | null): Promise<string[]> {
    const ip = requestContext.get()?.ip;
    const [history] = await this.db.execute<{ prior: number; known_device: boolean; known_network: boolean }>(sql`
      select
        count(*)::int as prior,
        coalesce(bool_or(${fingerprint}::text is not null and device_fingerprint = ${fingerprint}), false) as known_device,
        coalesce(bool_or(${ip ?? null}::inet is not null and ip is not null and family(ip) = family(${ip ?? null}::inet)
          and network(set_masklen(ip, case when family(ip) = 4 then 24 else 48 end))
            = network(set_masklen(${ip ?? null}::inet, case when family(ip) = 4 then 24 else 48 end))), false) as known_network
      from login_events
      where user_id = ${userId} and result = 'success' and created_at > now() - interval '180 days'`).then((r) => r.rows);
    if (!history || history.prior === 0) return [];
    const reasons: string[] = [];
    if (!history.known_device) reasons.push('new_device');
    if (!history.known_network) reasons.push('new_network');
    return reasons;
  }

  private async recordLogin(userId: string | null, identifier: string, result: 'success' | 'failed_password' | 'failed_2fa' | 'blocked' | 'locked', method: string, device: DeviceInfo, suspicious = false, reasons: string[] = []): Promise<void> {
    const ctx = requestContext.get();
    await this.db.insert(loginEvents).values({
      userId,
      identifier: identifier.slice(0, 254),
      result,
      method: method.slice(0, 20),
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      deviceFingerprint: device.deviceId ? this.crypto.sha256(`device:${device.deviceId}`) : null,
      suspicious,
      suspiciousReasons: reasons.length ? reasons : null,
    });
  }

  private async registerFailure(user: UserRow): Promise<void> {
    const [row] = await this.db
      .update(users)
      .set({ failedLoginCount: sql`${users.failedLoginCount} + 1` })
      .where(eq(users.id, user.id))
      .returning({ failures: users.failedLoginCount });
    const failures = row?.failures ?? 0;
    if (failures > 0 && failures % LOCK_AFTER_FAILURES === 0) {
      const minutes = Math.min(BASE_LOCK_MINUTES * 2 ** (failures / LOCK_AFTER_FAILURES - 1), MAX_LOCK_MINUTES);
      await this.db.update(users).set({ lockedUntil: new Date(Date.now() + minutes * 60_000) }).where(eq(users.id, user.id));
    }
  }

  private async checkSecondFactor(user: UserRow, code: string | undefined, recoveryCode: string | undefined): Promise<boolean> {
    if (code) {
      const step = verifyTotp(this.crypto.decrypt(user.twoFactorSecretEnc!), code);
      if (step === null) return false;
      // Each code works once, even inside its 30-second window.
      const last = Number((await this.redis.get(`2fa:step:${user.id}`)) ?? '-1');
      if (step <= last) return false;
      await this.redis.set(`2fa:step:${user.id}`, String(step), 'EX', 120);
      return true;
    }
    if (recoveryCode) {
      const normalized = recoveryCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const [used] = await this.db
        .update(twoFactorRecoveryCodes)
        .set({ usedAt: new Date() })
        .where(and(eq(twoFactorRecoveryCodes.userId, user.id), eq(twoFactorRecoveryCodes.codeHash, this.crypto.hmac(`recovery:${user.id}:${normalized}`)), isNull(twoFactorRecoveryCodes.usedAt)))
        .returning({ id: twoFactorRecoveryCodes.id });
      if (used) await this.audit.record({ action: 'user.2fa.recovery_code.use', entityType: 'user', entityId: user.id, actorId: user.id });
      return !!used;
    }
    return false;
  }

  private newRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const chars = Array.from(this.crypto.randomToken(16)).map((c) => RECOVERY_ALPHABET[c.charCodeAt(0) % RECOVERY_ALPHABET.length]);
      return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;
    });
  }

  private async storeRecoveryCodes(tx: DbOrTx, userId: string, codes: string[]): Promise<void> {
    await tx.insert(twoFactorRecoveryCodes).values(codes.map((c) => ({ userId, codeHash: this.crypto.hmac(`recovery:${userId}:${c.replace('-', '')}`) })));
  }

  private async findByIdentifier(identifier: Identifier, tx: DbOrTx = this.db): Promise<UserRow | undefined> {
    const column = identifier.kind === 'email' ? users.email : identifier.kind === 'phone' ? users.phone : users.username;
    const [user] = await tx.select().from(users).where(and(eq(column, identifier.value), isNull(users.deletedAt))).limit(1);
    return user;
  }

  private findByContact(contact: Contact, tx: DbOrTx = this.db): Promise<UserRow | undefined> {
    return this.findByIdentifier(contact, tx);
  }

  private async getUser(id: string): Promise<UserRow | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  private async usernameTaken(username: string, tx: DbOrTx = this.db): Promise<boolean> {
    const [row] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    return !!row;
  }

  /** "rahim.reads4821" from the email's local part, or "reader4821" for phone sign-ups. */
  private async generateUsername(contact: Contact, tx: DbOrTx): Promise<string> {
    let base = contact.kind === 'email' ? contact.value.split('@')[0]!.replace(/[^a-z0-9._]/gi, '').replace(/^[._]+|[._]+$/g, '').replace(/\.{2,}/g, '.').slice(0, 20).toLowerCase() : '';
    if (!/[a-z]/.test(base) || base.length < 3) base = 'reader';
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = `${base}${this.crypto.numericCode(attempt < 4 ? 4 : 6)}`;
      if (!(await this.usernameTaken(candidate, tx))) return candidate;
    }
    return `reader${this.crypto.randomToken(6).replace(/[^a-z0-9]/gi, '').toLowerCase()}`.slice(0, 30);
  }

  /** Lifts an expired suspension. */
  private async refreshStatus(user: UserRow): Promise<UserRow> {
    if (user.status === 'suspended' && user.suspendedUntil && user.suspendedUntil.getTime() <= Date.now()) {
      const [updated] = await this.db.update(users).set({ status: 'active', suspendedUntil: null }).where(eq(users.id, user.id)).returning();
      return updated ?? user;
    }
    return user;
  }

  private statusAllowsSignIn(user: UserRow): boolean {
    return user.status === 'active' && !user.deletedAt;
  }

  private assertStatus(user: UserRow, identifier: string): void {
    if (user.deletedAt || user.status === 'deleted') throw this.invalidCredentials();
    if (user.status === 'banned') {
      void this.recordLogin(user.id, identifier, 'blocked', 'password', { client: 'web', rememberDevice: false });
      throw new AppException('ACCOUNT_SUSPENDED', 'api.auth.accountBanned');
    }
    if (user.status === 'suspended') {
      void this.recordLogin(user.id, identifier, 'blocked', 'password', { client: 'web', rememberDevice: false });
      const locale: Locale = isLocale(user.locale) ? user.locale : 'bn';
      const until = user.suspendedUntil ? user.suspendedUntil.toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : '—';
      throw new AppException('ACCOUNT_SUSPENDED', 'api.auth.accountSuspended').withParams({ until });
    }
  }

  private invalidCredentials(): AppException {
    return new AppException('UNAUTHORIZED', 'api.auth.invalidCredentials', [], 401);
  }
}

/** 203.0.113.42 → 203.0.113.x; IPv6 keeps the first four groups. */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes('.')) return ip.replace(/\.\d+$/, '.x');
  return `${ip.split(':').slice(0, 4).join(':')}::x`;
}
