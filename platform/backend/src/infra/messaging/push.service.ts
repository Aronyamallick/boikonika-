import { Inject, Injectable, Logger } from '@nestjs/common';
import { pushSubscriptions, type Database } from '@boikonika/database';
import { eq, inArray, sql } from 'drizzle-orm';
import webpush from 'web-push';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { DB } from '../database/database.module';

export interface PushPayload {
  title: string;
  body: string;
  /** Absolute URL opened when the notification is tapped. */
  url?: string;
  /** Notifications with the same tag replace each other on the device. */
  tag?: string;
}

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
/** A subscription that keeps failing for other reasons is dropped after this many failures. */
const MAX_FAILURES = 5;

/**
 * Sends push notifications to every device a user registered: browsers through Web Push (VAPID)
 * and the mobile app through Expo's push service. Subscriptions the push service reports as gone
 * are removed.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');
  readonly webEnabled: boolean;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.webEnabled = !!(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);
    if (this.webEnabled) webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY!, config.VAPID_PRIVATE_KEY!);
  }

  get publicKey(): string | null {
    return this.webEnabled ? this.config.VAPID_PUBLIC_KEY! : null;
  }

  /** Delivers to all of the user's devices. Throws only when every device failed for a temporary reason. */
  async sendToUser(userId: string, payload: PushPayload): Promise<{ delivered: number; removed: number }> {
    const subs = await this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    let delivered = 0;
    const gone: string[] = [];
    const failed: string[] = [];
    const errors: string[] = [];

    const expo = subs.filter((s) => s.kind === 'expo');
    if (expo.length) {
      try {
        const res = await fetch(EXPO_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(expo.map((s) => ({ to: s.endpoint, title: payload.title, body: payload.body, data: { url: payload.url }, sound: 'default' }))),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Expo push responded ${res.status}`);
        const tickets = ((await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> }).data ?? [];
        tickets.forEach((ticket, i) => {
          const sub = expo[i]!;
          if (ticket.status === 'ok') delivered++;
          else if (ticket.details?.error === 'DeviceNotRegistered') gone.push(sub.id);
          else failed.push(sub.id);
        });
      } catch (error) {
        errors.push((error as Error).message);
        failed.push(...expo.map((s) => s.id));
      }
    }

    for (const sub of subs.filter((s) => s.kind === 'web')) {
      if (!this.webEnabled || !sub.keys) continue;
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 86_400, urgency: 'normal', timeout: 10_000 });
        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(sub.id);
        else {
          failed.push(sub.id);
          errors.push((error as Error).message);
        }
      }
    }

    if (gone.length) await this.db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    if (failed.length) {
      await this.db.update(pushSubscriptions).set({ failureCount: sql`${pushSubscriptions.failureCount} + 1` }).where(inArray(pushSubscriptions.id, failed));
      await this.db.delete(pushSubscriptions).where(sql`${pushSubscriptions.id} in (${sql.join(failed.map((id) => sql`${id}::uuid`), sql`, `)}) and ${pushSubscriptions.failureCount} >= ${MAX_FAILURES}`);
    }
    const okIds = subs.filter((s) => !gone.includes(s.id) && !failed.includes(s.id)).map((s) => s.id);
    if (okIds.length) await this.db.update(pushSubscriptions).set({ failureCount: 0, lastUsedAt: new Date() }).where(inArray(pushSubscriptions.id, okIds));
    if (!delivered && failed.length) throw new Error(`Push failed on every device: ${errors.join('; ').slice(0, 500)}`);
    if (errors.length) this.logger.warn(`Push to ${userId} partly failed: ${errors.join('; ').slice(0, 300)}`);
    return { delivered, removed: gone.length };
  }
}
