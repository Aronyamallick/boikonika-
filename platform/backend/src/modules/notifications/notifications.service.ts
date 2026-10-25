import { Inject, Injectable, Logger } from '@nestjs/common';
import { notificationPreferences, notifications, pushSubscriptions, users, type Database, type DbOrTx } from '@boikonika/database';
import { DEFAULT_NOTIFICATION_CHANNELS, isLocale, MANDATORY_NOTIFICATION_TYPES, translate, type NotificationChannel, type NotificationType } from '@boikonika/shared';
import { and, eq } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { DB } from '../../infra/database/database.module';
import { MessagesService } from '../../infra/messaging/messages.service';

export interface NotifyInput {
  type: NotificationType;
  /** i18n keys, rendered in the recipient's language. */
  titleKey: string;
  bodyKey: string;
  /** Placeholder values; dates are formatted for the recipient (Bangladesh time, their language). */
  params?: Record<string, string | number | Date>;
  /** App-relative link, e.g. "/account/security". */
  link?: string;
  data?: Record<string, unknown>;
  actorId?: string | null;
  groupKey?: string;
}

/**
 * Delivers a notification on the channels the user has enabled for its type (in-app, email, SMS;
 * push is added by the push module). Security notices cannot be switched off.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly messages: MessagesService,
  ) {}

  async notify(userId: string, input: NotifyInput, tx: DbOrTx = this.db): Promise<void> {
    const [user] = await tx
      .select({ locale: users.locale, email: users.email, emailVerifiedAt: users.emailVerifiedAt, phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || user.deletedAt) return;
    const locale = isLocale(user.locale) ? user.locale : 'bn';
    const params = Object.fromEntries(
      Object.entries(input.params ?? {}).map(([key, value]) => [
        key,
        value instanceof Date ? value.toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : value,
      ]),
    );
    const title = translate(locale, input.titleKey, params);
    const body = translate(locale, input.bodyKey, params);
    const channels = await this.channelsFor(userId, input.type, tx);

    if (channels.includes('in_app')) {
      await tx.insert(notifications).values({ userId, type: input.type, title, body, link: input.link ?? null, data: input.data ?? null, actorId: input.actorId ?? null, groupKey: input.groupKey ?? null });
    }
    const url = input.link ? `${this.config.APP_URL}${locale === 'en' ? '/en' : ''}${input.link}` : undefined;
    if (channels.includes('push')) {
      const [device] = await tx.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).limit(1);
      // Inside a transaction the push waits for the commit (the outbox poller sends it).
      if (device) await this.messages.sendPush(userId, { title, body, url, tag: input.groupKey }, tx === this.db ? undefined : tx);
    }
    try {
      if (channels.includes('email') && user.email && user.emailVerifiedAt) await this.messages.sendNotice(user.email, title, body, locale, url);
      if (channels.includes('sms') && user.phone && user.phoneVerifiedAt && (!user.email || !user.emailVerifiedAt || input.type !== 'security')) {
        // Security notices go by email when there is one; SMS is the fallback (and costs money).
        await this.messages.sendSms(user.phone, `${title}. ${body}`.slice(0, 320), `notice:${input.type}`);
      }
    } catch (error) {
      this.logger.error(`Could not queue ${input.type} notice for ${userId}: ${(error as Error).message}`);
    }
  }

  async channelsFor(userId: string, type: NotificationType, tx: DbOrTx = this.db): Promise<NotificationChannel[]> {
    const defaults = DEFAULT_NOTIFICATION_CHANNELS[type];
    if (MANDATORY_NOTIFICATION_TYPES.includes(type)) return defaults;
    const prefs = await tx
      .select({ channel: notificationPreferences.channel, enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type)));
    const enabled = new Set(defaults);
    for (const pref of prefs) {
      if (pref.enabled) enabled.add(pref.channel);
      else enabled.delete(pref.channel);
    }
    return [...enabled];
  }
}
