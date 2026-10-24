import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { outboundMessages, type Database, type DbOrTx } from '@boikonika/database';
import { and, eq, lte, sql } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { DB } from '../database/database.module';
import { createMailDriver, createSmsDriver, type MailDriver, type SmsDriver } from './drivers';

export interface OutgoingMessage {
  channel: 'email' | 'sms';
  recipient: string;
  subject?: string;
  body: string;
  html?: string;
  template: string;
  /** Contains a secret (OTP): the stored copy is redacted once delivered or abandoned. */
  sensitive?: boolean;
}

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_SECONDS = [60, 300, 900, 3600];
/** While a worker sends a message it is leased so other instances skip it. */
const LEASE_SECONDS = 120;
const REDACTED = '[redacted]';

/**
 * Transactional outbox for email and SMS. Messages are stored first (optionally inside the caller's
 * transaction), attempted immediately, and retried with backoff by a poller if the provider fails.
 */
@Injectable()
export class OutboxService implements OnApplicationShutdown {
  private readonly logger = new Logger('Outbox');
  private readonly mail: MailDriver;
  private readonly sms: SmsDriver;
  private readonly inFlight = new Set<Promise<unknown>>();
  private stopping = false;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.mail = createMailDriver(config);
    this.sms = createSmsDriver(config);
  }

  /** Stores the message. When `tx` is given, delivery starts only if that transaction commits. */
  async enqueue(message: OutgoingMessage, tx?: DbOrTx): Promise<string> {
    const [row] = await (tx ?? this.db)
      .insert(outboundMessages)
      .values({
        channel: message.channel,
        recipient: message.recipient,
        subject: message.subject ?? null,
        body: message.body,
        html: message.html ?? null,
        template: message.sensitive ? `${message.template}:sensitive` : message.template,
      })
      .returning({ id: outboundMessages.id });
    if (!tx) await this.dispatch(row!.id);
    return row!.id;
  }

  /** Starts delivery of an already-committed message (call after the enclosing transaction). */
  async dispatch(id: string): Promise<void> {
    if (this.config.isTest) {
      await this.deliver(id);
      return;
    }
    const task = this.deliver(id).catch((err: Error) => this.logger.error(`Delivery of ${id} crashed: ${err.message}`));
    this.inFlight.add(task);
    void task.finally(() => this.inFlight.delete(task));
  }

  @Interval('outbox-poller', 5000)
  async poll(): Promise<void> {
    if (this.stopping || this.config.isTest) return;
    const due = await this.db
      .select({ id: outboundMessages.id })
      .from(outboundMessages)
      .where(and(eq(outboundMessages.status, 'queued'), lte(outboundMessages.sendAfter, sql`now()`)))
      .orderBy(outboundMessages.sendAfter)
      .limit(20);
    for (const { id } of due) await this.deliver(id);
  }

  async deliver(id: string): Promise<boolean> {
    // Lease: only one worker gets the row, and a crash mid-send makes it due again after the lease.
    const [message] = await this.db
      .update(outboundMessages)
      .set({ sendAfter: sql`now() + make_interval(secs => ${LEASE_SECONDS})`, attempts: sql`${outboundMessages.attempts} + 1` })
      .where(and(eq(outboundMessages.id, id), eq(outboundMessages.status, 'queued'), lte(outboundMessages.sendAfter, sql`now()`)))
      .returning();
    if (!message) return false;
    const sensitive = message.template?.endsWith(':sensitive') ?? false;
    try {
      if (message.channel === 'email') {
        await this.mail.send({ to: message.recipient, subject: message.subject ?? '', text: message.body, html: message.html ?? undefined });
      } else {
        await this.sms.send({ to: message.recipient, text: message.body });
      }
      await this.db
        .update(outboundMessages)
        .set({ status: 'sent', sentAt: new Date(), lastError: null, ...(sensitive ? { subject: REDACTED, body: REDACTED, html: null } : {}) })
        .where(eq(outboundMessages.id, id));
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const giveUp = message.attempts >= MAX_ATTEMPTS;
      const delay = RETRY_DELAYS_SECONDS[Math.min(message.attempts - 1, RETRY_DELAYS_SECONDS.length - 1)]!;
      this.logger.warn(`${message.channel} to ${mask(message.recipient)} failed (attempt ${message.attempts}): ${reason}`);
      await this.db
        .update(outboundMessages)
        .set({
          status: giveUp ? 'failed' : 'queued',
          lastError: reason.slice(0, 1000),
          sendAfter: sql`now() + make_interval(secs => ${delay})`,
          ...(giveUp && sensitive ? { subject: REDACTED, body: REDACTED, html: null } : {}),
        })
        .where(eq(outboundMessages.id, id));
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    await Promise.allSettled([...this.inFlight]);
  }
}

function mask(recipient: string): string {
  return recipient.includes('@') ? recipient.replace(/^(.).*(@.*)$/, '$1***$2') : `${recipient.slice(0, 6)}****${recipient.slice(-2)}`;
}
