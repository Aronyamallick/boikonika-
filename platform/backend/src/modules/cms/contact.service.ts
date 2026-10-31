import { Inject, Injectable } from '@nestjs/common';
import { isLocale, translate, type contactMessageQuerySchema, type contactMessageSchema, type contactReplySchema, type ContactStatus } from '@boikonika/shared';
import { contactMessages, users, type Database } from '@boikonika/database';
import { eq, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { MessagesService } from '../../infra/messaging/messages.service';
import { REDIS } from '../../infra/redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

type Row = Record<string, unknown>;
const MESSAGES_PER_HOUR = 5;
const reference = (id: string) => id.slice(0, 8).toUpperCase();

/** The contact form and the staff inbox that answers it. */
@Injectable()
export class ContactService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly messages: MessagesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async submit(input: z.output<typeof contactMessageSchema>, meta: { userId?: string; ip?: string; locale: 'bn' | 'en' }) {
    // Guests are answered by email; signed-in people also get the answer in their notifications.
    if (!input.email && !meta.userId) throw AppException.validation([{ field: 'email', code: 'required', message: 'validation.emailForReply' }]);
    const key = `contact:${meta.userId ?? meta.ip ?? 'unknown'}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 3600);
    if (count > MESSAGES_PER_HOUR) throw new AppException('RATE_LIMITED', 'api.contact.tooMany');
    let email = input.email?.toLowerCase() ?? null;
    if (!email && meta.userId) {
      const [u] = await this.db.select({ email: users.email, verified: users.emailVerifiedAt }).from(users).where(eq(users.id, meta.userId));
      email = u?.verified ? u.email : null;
    }
    const [m] = await this.db
      .insert(contactMessages)
      .values({ userId: meta.userId ?? null, name: input.name, email, phone: input.phone ?? null, topic: input.topic, orderNumber: input.orderNumber || null, message: input.message, locale: meta.locale })
      .returning({ id: contactMessages.id });
    const ref = reference(m!.id);
    if (email) {
      await this.messages
        .sendNotice(email, translate(meta.locale, 'api.contact.mail.receivedTitle', { ref }), translate(meta.locale, 'api.contact.mail.receivedBody', { ref, name: input.name }), meta.locale)
        .catch(() => undefined);
    }
    return { id: m!.id, reference: ref };
  }

  async list(q: z.output<typeof contactMessageQuerySchema>) {
    const where = [q.status ? sql`m.status = ${q.status}` : sql`m.status = 'open'`];
    if (q.topic) where.push(sql`m.topic = ${q.topic}`);
    const condition = sql.join(where, sql` and `);
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select m.*, u.username, u.display_name as account_name, s.display_name as staff_name
        from contact_messages m left join users u on u.id = m.user_id left join users s on s.id = m.replied_by
        where ${condition} order by ${q.status && q.status !== 'open' ? sql`m.updated_at desc` : sql`m.created_at asc`}
        limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from contact_messages m where ${condition}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id as string,
        reference: reference(r.id as string),
        name: r.name as string,
        email: (r.email as string | null) ?? null,
        phone: (r.phone as string | null) ?? null,
        topic: r.topic as string,
        orderNumber: (r.order_number as string | null) ?? null,
        message: r.message as string,
        locale: r.locale as string,
        status: r.status as ContactStatus,
        account: r.user_id ? { id: r.user_id as string, name: r.account_name as string, username: (r.username as string | null) ?? null } : null,
        reply: (r.reply as string | null) ?? null,
        repliedBy: (r.staff_name as string | null) ?? null,
        repliedAt: r.replied_at ? new Date(r.replied_at as string).toISOString() : null,
        createdAt: new Date(r.created_at as string).toISOString(),
      })),
      meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  async reply(actorId: string, id: string, input: z.output<typeof contactReplySchema>) {
    const [m] = await this.db.select().from(contactMessages).where(eq(contactMessages.id, id));
    if (!m) throw AppException.notFound('Message');
    if (!m.email && !m.userId) throw AppException.badRequest('api.contact.noWayToReply');
    const status: ContactStatus = input.close ? 'closed' : 'answered';
    await this.db.update(contactMessages).set({ reply: input.reply, repliedBy: actorId, repliedAt: new Date(), status, updatedAt: new Date() }).where(eq(contactMessages.id, id));
    const locale = isLocale(m.locale) ? m.locale : 'bn';
    const ref = reference(m.id);
    if (m.email) {
      await this.messages
        .sendNotice(m.email, translate(locale, 'api.contact.mail.replyTitle', { ref }), translate(locale, 'api.contact.mail.replyBody', { ref, name: m.name, reply: input.reply, message: m.message.slice(0, 600) }), locale)
        .catch(() => undefined);
    }
    if (m.userId) {
      await this.notifications
        .notify(m.userId, { type: 'support', titleKey: 'api.contact.repliedTitle', bodyKey: 'api.contact.repliedBody', params: { ref, reply: input.reply.slice(0, 300) } })
        .catch(() => undefined);
    }
    await this.audit.record({ action: 'support.reply', entityType: 'contact_message', entityId: id, actorId, before: { status: m.status }, after: { status } });
    return { status };
  }

  async setStatus(actorId: string, id: string, status: ContactStatus) {
    const [m] = await this.db.update(contactMessages).set({ status, updatedAt: new Date() }).where(eq(contactMessages.id, id)).returning({ id: contactMessages.id });
    if (!m) throw AppException.notFound('Message');
    await this.audit.record({ action: 'support.status', entityType: 'contact_message', entityId: id, actorId, after: { status } });
    return { status };
  }

  async openCount(): Promise<number> {
    const [r] = await this.db.execute<{ n: number }>(sql`select count(*)::int as n from contact_messages where status = 'open'`).then((x) => x.rows);
    return r?.n ?? 0;
  }
}
