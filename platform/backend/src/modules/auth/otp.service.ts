import { Inject, Injectable } from '@nestjs/common';
import { otpCodes, type Database, type DbOrTx } from '@boikonika/database';
import type { Locale } from '@boikonika/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { AppException } from '../../common/errors/app-exception';
import { requestContext } from '../../common/context/request-context';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { CryptoService } from '../../infra/crypto/crypto.service';
import { DB } from '../../infra/database/database.module';
import { maskContact, MessagesService, type Contact } from '../../infra/messaging/messages.service';
import { REDIS } from '../../infra/redis/redis.module';

export type OtpPurpose = 'register' | 'login' | 'verify_phone' | 'verify_email' | 'reset_password' | 'change_contact';

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_PER_TARGET_PER_HOUR = 5;
const MAX_PER_IP_PER_HOUR = 20;

export interface IssueResult {
  sentTo: string;
  expiresIn: number;
  resendIn: number;
}

/**
 * One-time codes for registration, passwordless login, password reset and contact verification.
 * Codes are 6 random digits, stored only as an HMAC, valid for OTP_TTL_SECONDS, with limited
 * attempts; only the newest code for a target and purpose is valid. Sending is throttled per target,
 * per IP and platform-wide (SMS cost protection).
 */
@Injectable()
export class OtpService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly crypto: CryptoService,
    private readonly messages: MessagesService,
  ) {}

  /**
   * Checks the send limits and reserves the resend cooldown. Called for every request — including
   * ones where nothing is sent — so responses look the same whether or not an account exists.
   */
  async reserve(purpose: OtpPurpose, contact: Contact): Promise<IssueResult> {
    const target = contact.value;
    const cooldownKey = `otp:cd:${purpose}:${target}`;
    const reserved = await this.redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SECONDS, 'NX');
    if (!reserved) {
      const ttl = await this.redis.ttl(cooldownKey);
      throw new AppException('RATE_LIMITED', 'api.auth.otpCooldown', [], 429).withParams({ seconds: Math.max(ttl, 1) });
    }
    const ip = requestContext.get()?.ip ?? 'unknown';
    const [targetCount, ipCount] = await Promise.all([this.bump(`otp:h:${target}`, 3600), this.bump(`otp:ip:${ip}`, 3600)]);
    if (targetCount > MAX_PER_TARGET_PER_HOUR || ipCount > MAX_PER_IP_PER_HOUR) {
      throw new AppException('RATE_LIMITED', 'api.auth.otpLimit', [], 429);
    }
    if (contact.kind === 'phone') {
      const today = new Date().toISOString().slice(0, 10);
      if ((await this.bump(`otp:sms:${today}`, 86_400)) > this.config.SMS_DAILY_LIMIT) {
        throw new AppException('SERVICE_UNAVAILABLE', 'api.auth.otpLimit', [], 503);
      }
    }
    return { sentTo: maskContact(contact), expiresIn: this.config.OTP_TTL_SECONDS, resendIn: RESEND_COOLDOWN_SECONDS };
  }

  /** Creates a code (invalidating older ones) and queues it to the contact. Call after reserve(). */
  async send(purpose: OtpPurpose, contact: Contact, locale: Locale, userId?: string | null): Promise<void> {
    const code = this.crypto.numericCode(6);
    await this.db.transaction(async (tx) => {
      await tx
        .update(otpCodes)
        .set({ consumedAt: sql`now()` })
        .where(and(eq(otpCodes.target, contact.value), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt)));
      await tx.insert(otpCodes).values({
        purpose,
        target: contact.value,
        userId: userId ?? null,
        codeHash: this.hashCode(purpose, contact.value, code),
        maxAttempts: this.config.OTP_MAX_ATTEMPTS,
        expiresAt: sql`now() + make_interval(secs => ${this.config.OTP_TTL_SECONDS})`,
        ip: requestContext.get()?.ip ?? null,
      });
    });
    await this.messages.sendOtp(contact, code, Math.round(this.config.OTP_TTL_SECONDS / 60), locale);
  }

  /**
   * Validates and consumes the newest code. Pass the caller's transaction so a failure later in the
   * same operation (e.g. a username clash) rolls the consumption back and the code stays usable.
   */
  async verify(purpose: OtpPurpose, target: string, code: string, tx: DbOrTx = this.db): Promise<{ userId: string | null }> {
    const [row] = await tx
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.target, target), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt)))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    if (!row) throw new AppException('BAD_REQUEST', 'api.auth.otpInvalid', [{ field: 'code', code: 'otp_invalid', message: 'api.auth.otpInvalid' }]);
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new AppException('BAD_REQUEST', 'api.auth.otpExpired', [{ field: 'code', code: 'otp_expired', message: 'api.auth.otpExpired' }]);
    }
    // Every attempt is counted atomically *before* comparing, so parallel guesses cannot exceed the
    // limit. Counted outside the caller's transaction so a rollback cannot reset it.
    const [counted] = await this.db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(and(eq(otpCodes.id, row.id), sql`${otpCodes.attempts} < ${otpCodes.maxAttempts}`))
      .returning({ attempts: otpCodes.attempts });
    if (!counted) {
      throw new AppException('BAD_REQUEST', 'api.auth.otpTooManyAttempts', [{ field: 'code', code: 'otp_attempts', message: 'api.auth.otpTooManyAttempts' }]);
    }
    if (!this.crypto.safeEqual(row.codeHash, this.hashCode(purpose, target, code))) {
      throw new AppException('BAD_REQUEST', 'api.auth.otpInvalid', [{ field: 'code', code: 'otp_invalid', message: 'api.auth.otpInvalid' }]);
    }
    const [consumed] = await tx
      .update(otpCodes)
      .set({ consumedAt: sql`now()` })
      .where(and(eq(otpCodes.id, row.id), isNull(otpCodes.consumedAt)))
      .returning({ id: otpCodes.id });
    if (!consumed) throw new AppException('BAD_REQUEST', 'api.auth.otpInvalid', [{ field: 'code', code: 'otp_invalid', message: 'api.auth.otpInvalid' }]);
    return { userId: row.userId };
  }

  private hashCode(purpose: string, target: string, code: string): string {
    return this.crypto.hmac(`otp:${purpose}:${target}:${code}`);
  }

  private async bump(key: string, ttlSeconds: number): Promise<number> {
    const [[, count]] = (await this.redis.multi().incr(key).expire(key, ttlSeconds, 'NX').exec()) as [[null, number]];
    return count;
  }
}
