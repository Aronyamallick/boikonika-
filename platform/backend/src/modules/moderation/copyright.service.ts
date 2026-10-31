import { Inject, Injectable } from '@nestjs/common';
import { copyrightClaims, type Database } from '@boikonika/database';
import { translate, type copyrightClaimSchema, type copyrightDecisionSchema, type counterNoticeSchema, type CopyrightTarget } from '@boikonika/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { MessagesService } from '../../infra/messaging/messages.service';
import { REDIS } from '../../infra/redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { DigitalService } from '../digital/digital.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationAdminService } from './moderation-admin.service';

type Row = Record<string, unknown>;
type Claim = typeof copyrightClaims.$inferSelect;
const CLAIMS_PER_HOUR = 5;

/**
 * Copyright complaints: anyone can ask for content to be taken down by pointing at it and making the
 * required statements; staff decide; the person who published it is told and can answer with a
 * counter-notice; staff may then restore it. Every step is audited and both sides are kept informed.
 */
@Injectable()
export class CopyrightService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly digital: DigitalService,
    private readonly moderation: ModerationAdminService,
    private readonly messages: MessagesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** Finds what a link on this site points at, and who published it. */
  async resolve(contentUrl: string): Promise<{ type: CopyrightTarget; id: string; respondentId: string | null; title: string }> {
    let url: URL;
    try {
      url = new URL(contentUrl);
    } catch {
      throw AppException.validation([{ field: 'contentUrl', code: 'invalid', message: 'api.copyright.unknownContent' }]);
    }
    const site = new URL(this.config.APP_URL);
    if (url.host !== site.host) throw AppException.validation([{ field: 'contentUrl', code: 'external', message: 'api.copyright.notOurSite' }]);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'en' || parts[0] === 'bn') parts.shift();
    const [section, key] = parts;
    let row: Row | undefined;
    if (section === 'books' && key) {
      row = (await this.db.execute<Row>(sql`
        select x.id, 'digital_asset' as type, x.uploaded_by as owner, b.title from books b
        join book_formats f on f.book_id = b.id and f.format = 'digital'
        join digital_assets x on x.book_format_id = f.id and x.status in ('active', 'withdrawn')
        where b.slug = ${key} order by x.created_at desc limit 1`)).rows[0];
      if (!row) throw AppException.validation([{ field: 'contentUrl', code: 'not_hosted', message: 'api.copyright.noDigitalCopy' }]);
    } else if (section === 'products' && key) {
      row = (await this.db.execute<Row>(sql`select p.id, 'product' as type, s.user_id as owner, p.title from products p join sellers s on s.id = p.seller_id where p.slug = ${key} and p.deleted_at is null`)).rows[0];
    } else if (section === 'posts' && key && /^[0-9a-f-]{36}$/.test(key)) {
      row = (await this.db.execute<Row>(sql`select p.id, 'post' as type, p.author_id as owner, coalesce(p.title, left(p.body, 80)) as title from posts p where p.id = ${key}`)).rows[0];
    }
    if (!row) throw AppException.validation([{ field: 'contentUrl', code: 'unknown', message: 'api.copyright.unknownContent' }]);
    return { type: row.type as CopyrightTarget, id: row.id as string, respondentId: (row.owner as string | null) ?? null, title: (row.title as string) ?? '' };
  }

  async submit(input: z.output<typeof copyrightClaimSchema>, meta: { userId?: string; ip?: string; locale: 'bn' | 'en' }) {
    const who = meta.userId ?? meta.ip ?? 'unknown';
    const key = `copyright:claims:${who}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 3600);
    if (count > CLAIMS_PER_HOUR) throw new AppException('RATE_LIMITED', 'api.copyright.tooMany');
    const target = await this.resolve(input.contentUrl);
    if (target.respondentId && target.respondentId === meta.userId) throw AppException.badRequest('api.copyright.ownContent');
    const [claim] = await this.db
      .insert(copyrightClaims)
      .values({
        claimantUserId: meta.userId ?? null,
        claimantName: input.claimantName,
        claimantEmail: input.claimantEmail.toLowerCase(),
        claimantPhone: input.claimantPhone || null,
        rightsHolder: input.rightsHolder,
        workDescription: input.workDescription,
        targetType: target.type,
        targetId: target.id,
        evidenceUrls: input.evidenceUrls,
        goodFaithStatement: input.goodFaithStatement,
        accuracyStatement: input.accuracyStatement,
        signature: input.signature,
        respondentUserId: target.respondentId,
        meta: { contentUrl: input.contentUrl, title: target.title, locale: meta.locale, ip: meta.ip?.slice(0, 45) ?? null },
      })
      .returning();
    await this.audit.record({ action: 'copyright.claim', entityType: 'copyright_claim', entityId: claim!.id, actorId: meta.userId ?? null, after: { target: target.type, targetId: target.id } });
    await this.emailClaimant(claim!, 'received', '');
    return { id: claim!.id, reference: claim!.id.slice(0, 8).toUpperCase() };
  }

  private async emailClaimant(claim: Claim, kind: 'received' | 'upheld' | 'rejected' | 'counter' | 'restored', note: string) {
    const ref = claim.id.slice(0, 8).toUpperCase();
    const locale = claim.meta?.locale === 'en' ? 'en' : 'bn';
    const title = (claim.meta?.title as string | undefined) ?? '';
    await this.messages
      .sendNotice(claim.claimantEmail, translate(locale, `api.copyright.mail.${kind}Title`, { ref }), translate(locale, `api.copyright.mail.${kind}Body`, { ref, title, note }), locale)
      .catch(() => undefined);
  }

  // ------------------------------------------------------------------ staff

  async list(filter: { status?: string; page: number; pageSize: number }) {
    const where = filter.status ? sql`c.status = ${filter.status}` : sql`c.status in ('submitted', 'under_review', 'counter_noticed')`;
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select c.*, u.display_name as respondent_name, u.username as respondent_username, h.display_name as handler_name
        from copyright_claims c left join users u on u.id = c.respondent_user_id left join users h on h.id = c.handled_by
        where ${where} order by c.created_at asc limit ${filter.pageSize} offset ${(filter.page - 1) * filter.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from copyright_claims c where ${where}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id as string,
        reference: (r.id as string).slice(0, 8).toUpperCase(),
        status: r.status as string,
        claimant: { name: r.claimant_name as string, email: r.claimant_email as string, phone: (r.claimant_phone as string | null) ?? null, rightsHolder: r.rights_holder as string },
        workDescription: r.work_description as string,
        evidenceUrls: (r.evidence_urls as string[] | null) ?? [],
        signature: r.signature as string,
        target: { type: r.target_type as string, id: r.target_id as string, title: ((r.meta as Row | null)?.title as string | undefined) ?? '', url: ((r.meta as Row | null)?.contentUrl as string | undefined) ?? null },
        respondent: r.respondent_user_id ? { id: r.respondent_user_id as string, name: r.respondent_name as string, username: (r.respondent_username as string | null) ?? null } : null,
        counter: r.counter_statement ? { statement: r.counter_statement as string, signature: r.counter_signature as string, at: new Date(r.counter_submitted_at as string).toISOString() } : null,
        adminNote: (r.admin_note as string | null) ?? null,
        handler: (r.handler_name as string | null) ?? null,
        createdAt: new Date(r.created_at as string).toISOString(),
        resolvedAt: r.resolved_at ? new Date(r.resolved_at as string).toISOString() : null,
      })),
      meta: { page: filter.page, pageSize: filter.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  private async takeDown(actorId: string, claim: Claim, note: string) {
    if (claim.targetType === 'digital_asset') await this.digital.takedown(actorId, claim.targetId, note);
    else await this.db.transaction((tx) => this.moderation.hide(tx, claim.targetType, claim.targetId));
  }

  private async putBack(actorId: string, claim: Claim) {
    if (claim.targetType === 'digital_asset') await this.digital.restore(actorId, claim.targetId);
    else await this.db.transaction((tx) => this.moderation.restore(tx, claim.targetType, claim.targetId));
  }

  /**
   * review → under review · uphold → content taken down, publisher told how to respond ·
   * reject → nothing removed · restore / keep_removed → the answer to a counter-notice.
   */
  async decide(actorId: string, id: string, input: z.output<typeof copyrightDecisionSchema>) {
    const [claim] = await this.db.select().from(copyrightClaims).where(eq(copyrightClaims.id, id));
    if (!claim) throw AppException.notFound('Claim');
    const allowed: Record<string, string[]> = {
      review: ['submitted'],
      uphold: ['submitted', 'under_review'],
      reject: ['submitted', 'under_review'],
      restore: ['counter_noticed'],
      keep_removed: ['counter_noticed'],
    };
    if (!allowed[input.decision]!.includes(claim.status)) throw new AppException('CONFLICT', 'api.copyright.wrongState').withParams({ status: claim.status });
    const status = { review: 'under_review', uphold: 'content_removed', reject: 'rejected', restore: 'restored', keep_removed: 'content_removed' }[input.decision] as Claim['status'];

    if (input.decision === 'uphold') await this.takeDown(actorId, claim, input.note);
    if (input.decision === 'restore') await this.putBack(actorId, claim);
    const final = input.decision !== 'review';
    await this.db
      .update(copyrightClaims)
      .set({ status, adminNote: input.note, handledBy: actorId, resolvedAt: final ? new Date() : null, meta: sql`coalesce(${copyrightClaims.meta}, '{}'::jsonb) || ${JSON.stringify({ lastDecision: input.decision })}::jsonb`, updatedAt: new Date() })
      .where(eq(copyrightClaims.id, id));
    await this.audit.record({ action: `copyright.${input.decision}`, entityType: 'copyright_claim', entityId: id, actorId, before: { status: claim.status }, after: { status, note: input.note } });

    if (input.decision === 'uphold') await this.emailClaimant(claim, 'upheld', input.note);
    if (input.decision === 'reject') await this.emailClaimant(claim, 'rejected', input.note);
    if (input.decision === 'restore') await this.emailClaimant(claim, 'restored', input.note);
    if (claim.respondentUserId && ['uphold', 'restore', 'keep_removed'].includes(input.decision)) {
      await this.notifications
        .notify(claim.respondentUserId, { type: 'moderation', titleKey: `api.copyright.${input.decision}Title`, bodyKey: `api.copyright.${input.decision}Body`, params: { title: (claim.meta?.title as string | undefined) ?? '', note: input.note }, link: '/account/standing' })
        .catch(() => undefined);
    }
    return { status };
  }

  // ------------------------------------------------------------------ the publisher's side

  /** Complaints about content I published (claimant contact details are not shown). */
  async mine(userId: string) {
    const rows = await this.db.select().from(copyrightClaims).where(eq(copyrightClaims.respondentUserId, userId)).orderBy(desc(copyrightClaims.createdAt)).limit(50);
    return rows.map((c) => ({
      id: c.id,
      reference: c.id.slice(0, 8).toUpperCase(),
      status: c.status,
      rightsHolder: c.rightsHolder,
      workDescription: c.workDescription,
      title: (c.meta?.title as string | undefined) ?? '',
      adminNote: c.status === 'submitted' || c.status === 'under_review' ? null : c.adminNote,
      canCounter: c.status === 'content_removed' && !c.counterSubmittedAt,
      counterSubmittedAt: c.counterSubmittedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async counter(userId: string, id: string, input: z.output<typeof counterNoticeSchema>) {
    const [claim] = await this.db.select().from(copyrightClaims).where(and(eq(copyrightClaims.id, id), eq(copyrightClaims.respondentUserId, userId)));
    if (!claim) throw AppException.notFound('Claim');
    if (claim.status !== 'content_removed' || claim.counterSubmittedAt) throw new AppException('CONFLICT', 'api.copyright.cannotCounter');
    await this.db
      .update(copyrightClaims)
      .set({ status: 'counter_noticed', counterStatement: input.statement, counterSignature: input.signature, counterSubmittedAt: new Date(), updatedAt: new Date() })
      .where(eq(copyrightClaims.id, id));
    await this.audit.record({ action: 'copyright.counter', entityType: 'copyright_claim', entityId: id, actorId: userId });
    await this.emailClaimant(claim, 'counter', input.statement.slice(0, 500));
    return { status: 'counter_noticed' as const };
  }

  async openCount(): Promise<number> {
    const [r] = await this.db.execute<{ n: number }>(sql`select count(*)::int as n from copyright_claims where status in ('submitted', 'under_review', 'counter_noticed')`).then((x) => x.rows);
    return r?.n ?? 0;
  }
}
