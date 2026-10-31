import { Inject, Injectable, Logger } from '@nestjs/common';
import { notificationPreferences, notifications, pushSubscriptions, type Database } from '@boikonika/database';
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  MANDATORY_NOTIFICATION_TYPES,
  NOTIFICATION_CHANNEL_OPTIONS,
  NOTIFICATION_TYPES,
  type BroadcastAudience,
  type broadcastSchema,
  type NotificationChannel,
  type NotificationType,
  type pushSubscriptionSchema,
} from '@boikonika/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { AppException } from '../../common/errors/app-exception';
import { decodeCursor, encodeCursor } from '../../common/util/pagination';
import { DB } from '../../infra/database/database.module';
import { MessagesService } from '../../infra/messaging/messages.service';
import { PushService } from '../../infra/messaging/push.service';
import { REDIS } from '../../infra/redis/redis.module';
import { AuditService } from '../audit/audit.service';

const cursorSchema = z.object({ t: z.string(), id: z.uuid() });
const MAX_DEVICES = 10;
const BROADCASTS_PER_HOUR = 3;

/**
 * The reader's side of notifications: the inbox, per-type channel choices and push devices; plus
 * staff announcements, written in both languages and delivered on each reader's chosen channels.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger('Inbox');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly messages: MessagesService,
    private readonly push: PushService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ inbox

  async list(userId: string, q: { cursor?: string; limit: number; unread?: boolean }) {
    const after = decodeCursor(q.cursor, cursorSchema);
    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          q.unread ? isNull(notifications.readAt) : undefined,
          after ? sql`(${notifications.createdAt}, ${notifications.id}) < (${after.t}::timestamptz, ${after.id}::uuid)` : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return {
      items: page.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: !!n.readAt, createdAt: n.createdAt.toISOString() })),
      nextCursor: rows.length > q.limit && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async unreadCount(userId: string): Promise<{ unread: number }> {
    const [row] = await this.db.execute<{ n: number }>(sql`select count(*)::int as n from notifications where user_id = ${userId} and read_at is null`).then((r) => r.rows);
    return { unread: row?.n ?? 0 };
  }

  async markRead(userId: string, id: string) {
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });
    if (!row) throw AppException.notFound('Notification');
    return this.unreadCount(userId);
  }

  async markAllRead(userId: string) {
    await this.db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { unread: 0 };
  }

  async remove(userId: string, id: string) {
    const [row] = await this.db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning({ id: notifications.id });
    if (!row) throw AppException.notFound('Notification');
    return this.unreadCount(userId);
  }

  // ------------------------------------------------------------------ preferences

  /** Every type with the channels on offer, which are on, and whether it can be switched off. */
  async preferences(userId: string) {
    const rows = await this.db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    const [device] = await this.db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).limit(1);
    return {
      pushAvailable: this.push.webEnabled,
      hasPushDevice: !!device,
      types: NOTIFICATION_TYPES.map((type) => {
        const mandatory = MANDATORY_NOTIFICATION_TYPES.includes(type);
        const enabled = new Set<NotificationChannel>(DEFAULT_NOTIFICATION_CHANNELS[type]);
        if (!mandatory) for (const r of rows.filter((x) => x.type === type)) r.enabled ? enabled.add(r.channel) : enabled.delete(r.channel);
        return { type, mandatory, channels: NOTIFICATION_CHANNEL_OPTIONS[type].map((channel) => ({ channel, enabled: enabled.has(channel) })) };
      }),
    };
  }

  async setPreferences(userId: string, changes: Array<{ type: NotificationType; channel: NotificationChannel; enabled: boolean }>) {
    for (const [i, c] of changes.entries()) {
      if (MANDATORY_NOTIFICATION_TYPES.includes(c.type)) throw AppException.validation([{ field: `preferences.${i}.type`, code: 'mandatory', message: 'api.notifications.mandatory' }]);
      if (!NOTIFICATION_CHANNEL_OPTIONS[c.type].includes(c.channel)) throw AppException.validation([{ field: `preferences.${i}.channel`, code: 'unavailable', message: 'validation.invalidChoice' }]);
    }
    await this.db.transaction(async (tx) => {
      for (const c of changes) {
        await tx
          .insert(notificationPreferences)
          .values({ userId, type: c.type, channel: c.channel, enabled: c.enabled })
          .onConflictDoUpdate({ target: [notificationPreferences.userId, notificationPreferences.type, notificationPreferences.channel], set: { enabled: c.enabled, updatedAt: new Date() } });
      }
    });
    return this.preferences(userId);
  }

  // ------------------------------------------------------------------ push devices

  async subscribe(userId: string, input: z.output<typeof pushSubscriptionSchema>, userAgent?: string) {
    if (input.kind === 'web' && !this.push.webEnabled) throw AppException.badRequest('api.notifications.pushUnavailable');
    await this.db.transaction(async (tx) => {
      // A device belongs to whoever signed in on it last.
      await tx
        .insert(pushSubscriptions)
        .values({ userId, kind: input.kind, endpoint: input.endpoint, keys: input.kind === 'web' ? input.keys : null, userAgent: userAgent?.slice(0, 300) ?? null, lastUsedAt: new Date() })
        .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, keys: input.kind === 'web' ? input.keys : null, failureCount: 0, userAgent: userAgent?.slice(0, 300) ?? null, lastUsedAt: new Date() } });
      // Keep only the most recent devices.
      await tx.execute(sql`
        delete from push_subscriptions where user_id = ${userId} and id not in (
          select id from push_subscriptions where user_id = ${userId} order by last_used_at desc nulls last limit ${MAX_DEVICES})`);
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
    return { subscribed: false };
  }

  /** Sends a test notification to the caller's own devices. */
  async test(userId: string, locale: 'bn' | 'en') {
    const title = locale === 'bn' ? 'বইকণিকা থেকে পরীক্ষামূলক নোটিফিকেশন' : 'Test notification from Boikonika';
    const body = locale === 'bn' ? 'এই ডিভাইসে নোটিফিকেশন ঠিকঠাক আসছে।' : 'Notifications are working on this device.';
    const result = await this.push.sendToUser(userId, { title, body, url: `${this.config.APP_URL}${locale === 'en' ? '/en' : ''}/notifications`, tag: 'test' });
    if (!result.delivered) throw AppException.badRequest('api.notifications.noDevice');
    return result;
  }

  // ------------------------------------------------------------------ announcements

  private audienceSql(audience: BroadcastAudience) {
    const role = (r: string) => sql`exists (select 1 from user_roles ur where ur.user_id = u.id and ur.role = ${r})`;
    switch (audience) {
      case 'students':
        return role('student');
      case 'teachers':
        return role('teacher');
      case 'authors':
        return role('author');
      case 'publishers':
        return role('publisher');
      case 'sellers':
        return sql`exists (select 1 from sellers s where s.user_id = u.id and s.status = 'active')`;
      default:
        return sql`true`;
    }
  }

  /**
   * An announcement in each reader's language: in-app for everyone who hasn't switched announcements
   * off, and push/email only for those who turned those on. Limited to a few per hour.
   */
  async broadcast(actorId: string, input: z.output<typeof broadcastSchema>) {
    const key = `broadcasts:${new Date().toISOString().slice(0, 13)}`;
    const count = await this.redis.incr(key);
    await this.redis.expire(key, 3600);
    if (count > BROADCASTS_PER_HOUR) throw new AppException('RATE_LIMITED', 'api.notifications.broadcastLimit').withParams({ count: BROADCASTS_PER_HOUR });

    const recipients = sql`
      from users u where u.status = 'active' and u.deleted_at is null and ${this.audienceSql(input.audience)}`;
    const optedOut = (channel: NotificationChannel) => sql`exists (select 1 from notification_preferences p where p.user_id = u.id and p.type = 'announcement' and p.channel = ${channel} and not p.enabled)`;
    const optedIn = (channel: NotificationChannel) => sql`exists (select 1 from notification_preferences p where p.user_id = u.id and p.type = 'announcement' and p.channel = ${channel} and p.enabled)`;
    const link = input.link ?? null;

    const inserted = await this.db.execute<{ n: number }>(sql`
      with sent as (
        insert into notifications (user_id, type, title, body, link)
        select u.id, 'announcement',
          case when u.locale = 'en' then ${input.title.en} else ${input.title.bn} end,
          case when u.locale = 'en' then ${input.body.en} else ${input.body.bn} end,
          ${link}
        ${recipients} and not ${optedOut('in_app')}
        returning 1)
      select count(*)::int as n from sent`);
    const inApp = inserted.rows[0]?.n ?? 0;

    // Extra channels only for readers who asked for them.
    const extras = await this.db.execute<{ id: string; locale: string; email: string | null; email_ok: boolean; push: boolean; mail: boolean }>(sql`
      select u.id, u.locale, u.email, u.email_verified_at is not null as email_ok, ${optedIn('push')} as push, ${optedIn('email')} as mail
      ${recipients} and (${optedIn('push')} or ${optedIn('email')})`);
    void (async () => {
      for (const u of extras.rows) {
        const en = u.locale === 'en';
        const title = en ? input.title.en : input.title.bn;
        const body = en ? input.body.en : input.body.bn;
        const url = link ? `${this.config.APP_URL}${en ? '/en' : ''}${link}` : undefined;
        try {
          if (u.push) await this.messages.sendPush(u.id, { title, body, url, tag: 'announcement' });
          if (u.mail && u.email && u.email_ok) await this.messages.sendNotice(u.email, title, body, en ? 'en' : 'bn', url);
        } catch (error) {
          this.logger.warn(`Announcement extras for ${u.id} failed: ${(error as Error).message}`);
        }
      }
    })();
    await this.audit.record({ action: 'notification.broadcast', entityType: 'announcement', actorId, after: { audience: input.audience, title: input.title, link, recipients: inApp, extras: extras.rows.length } });
    return { recipients: inApp, extraChannels: extras.rows.length };
  }
}
