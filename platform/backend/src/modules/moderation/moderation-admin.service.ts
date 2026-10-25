import { Inject, Injectable } from '@nestjs/common';
import { moderationActions, refreshBookOffers, refreshRatings, refreshStoreProductCounts, reports, userRestrictions, users, type Database, type DbOrTx } from '@boikonika/database';
import type { ModerationAction, reportDecisionSchema, RestrictionScope } from '@boikonika/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../auth/sessions.service';
import { NotificationsService } from '../notifications/notifications.service';

type Row = Record<string, unknown>;
type Decision = z.output<typeof reportDecisionSchema>;
const OPEN = ['reported', 'under_review'] as const;

/** Content tables whose rows share the content_status enum (published · pending_review · removed …). */
const CONTENT: Record<string, string> = { post: 'posts', comment: 'comments', review: 'reviews', club_post: 'book_club_posts', club: 'book_clubs', book: 'books' };

export interface TargetPreview {
  type: string;
  id: string;
  title: string;
  excerpt: string | null;
  status: string | null;
  link: string | null;
  owner: { id: string; name: string; username: string | null; status: string } | null;
}

/**
 * The moderation desk: open reports grouped by what they are about, held content, and decisions —
 * warning, removal, temporary restriction, suspension or ban — each recorded, explained to the
 * person affected, reversible, and audited.
 */
@Injectable()
export class ModerationAdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sessions: SessionsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ targets

  /** What a report points at, in a form a moderator can judge (and who owns it). */
  async previews(targets: Array<{ type: string; id: string }>, tx: DbOrTx = this.db): Promise<Map<string, TargetPreview>> {
    const out = new Map<string, TargetPreview>();
    const byType = new Map<string, string[]>();
    for (const t of targets) byType.set(t.type, [...(byType.get(t.type) ?? []), t.id]);
    const ids = (list: string[]) => sql`(${sql.join(list.map((id) => sql`${id}::uuid`), sql`, `)})`;
    for (const [type, list] of byType) {
      let rows: Row[] = [];
      switch (type) {
        case 'post':
          rows = (await tx.execute<Row>(sql`select p.id, coalesce(p.title, left(p.body, 80)) as title, left(p.body, 300) as excerpt, p.status::text as status, '/posts/' || p.id as link, p.author_id as owner_id from posts p where p.id in ${ids(list)}`)).rows;
          break;
        case 'comment':
          rows = (await tx.execute<Row>(sql`select c.id, left(c.body, 80) as title, left(c.body, 300) as excerpt, c.status::text as status, '/posts/' || c.post_id as link, c.author_id as owner_id from comments c where c.id in ${ids(list)}`)).rows;
          break;
        case 'review':
          rows = (await tx.execute<Row>(sql`
            select r.id, coalesce(r.title, left(r.body, 80), r.rating || '★') as title, left(r.body, 300) as excerpt, r.status::text as status,
              coalesce('/books/' || b.slug, '/products/' || p.slug) as link, r.user_id as owner_id
            from reviews r left join books b on b.id = r.book_id left join products p on p.id = r.product_id where r.id in ${ids(list)}`)).rows;
          break;
        case 'product':
          rows = (await tx.execute<Row>(sql`select p.id, p.title, left(p.description, 300) as excerpt, p.status::text as status, '/products/' || p.slug as link, s.user_id as owner_id from products p join sellers s on s.id = p.seller_id where p.id in ${ids(list)}`)).rows;
          break;
        case 'book':
          rows = (await tx.execute<Row>(sql`select b.id, b.title, left(b.description, 300) as excerpt, b.status::text as status, '/books/' || b.slug as link, null::uuid as owner_id from books b where b.id in ${ids(list)}`)).rows;
          break;
        case 'user':
          rows = (await tx.execute<Row>(sql`select u.id, u.display_name as title, left(pr.bio, 300) as excerpt, u.status::text as status, '/u/' || u.username as link, u.id as owner_id from users u left join user_profiles pr on pr.user_id = u.id where u.id in ${ids(list)}`)).rows;
          break;
        case 'club':
          rows = (await tx.execute<Row>(sql`select c.id, c.name as title, left(c.description, 300) as excerpt, c.status::text as status, '/clubs/' || c.slug as link, c.owner_id from book_clubs c where c.id in ${ids(list)}`)).rows;
          break;
        case 'club_post':
          rows = (await tx.execute<Row>(sql`select cp.id, left(cp.body, 80) as title, left(cp.body, 300) as excerpt, cp.status::text as status, '/clubs/' || c.slug as link, cp.author_id as owner_id from book_club_posts cp join book_clubs c on c.id = cp.club_id where cp.id in ${ids(list)}`)).rows;
          break;
        case 'store':
          rows = (await tx.execute<Row>(sql`select st.id, st.name as title, left(st.description, 300) as excerpt, se.status::text as status, '/stores/' || st.slug as link, se.user_id as owner_id from seller_stores st join sellers se on se.id = st.seller_id where st.id in ${ids(list)}`)).rows;
          break;
      }
      const owners = [...new Set(rows.map((r) => r.owner_id as string | null).filter((x): x is string => !!x))];
      const people = owners.length ? (await tx.execute<{ id: string; display_name: string; username: string | null; status: string }>(sql`select id, display_name, username, status::text as status from users where id in ${ids(owners)}`)).rows : [];
      for (const r of rows) {
        const owner = people.find((p) => p.id === r.owner_id);
        out.set(`${type}:${r.id}`, {
          type,
          id: r.id as string,
          title: (r.title as string | null) ?? '—',
          excerpt: (r.excerpt as string | null) ?? null,
          status: (r.status as string | null) ?? null,
          link: (r.link as string | null) ?? null,
          owner: owner ? { id: owner.id, name: owner.display_name, username: owner.username, status: owner.status } : null,
        });
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ queue

  /** Reports grouped by target: urgent first, then oldest. */
  async queue(q: { status?: string; priority?: string; targetType?: string; page: number; pageSize: number }) {
    const where = [q.status ? sql`r.status = ${q.status}` : sql`r.status in ('reported', 'under_review')`];
    if (q.targetType) where.push(sql`r.target_type = ${q.targetType}`);
    const condition = sql.join(where, sql` and `);
    const having = q.priority ? sql`having bool_or(r.priority = 'high') = ${q.priority === 'high'}` : sql``;
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select r.target_type, r.target_id, count(*)::int as reports, count(distinct r.reporter_id)::int as reporters,
          array_agg(distinct r.reason::text) as reasons, bool_or(r.priority = 'high') as urgent,
          min(r.created_at) as first_at, max(r.created_at) as last_at,
          (array_agg(r.status::text order by r.created_at desc))[1] as status,
          (array_agg(u.display_name order by r.created_at desc) filter (where r.assigned_to is not null))[1] as assignee,
          coalesce(json_agg(json_build_object('reason', r.reason, 'details', r.details, 'at', r.created_at) order by r.created_at desc) filter (where r.details is not null), '[]') as notes
        from reports r left join users u on u.id = r.assigned_to
        where ${condition}
        group by r.target_type, r.target_id ${having}
        order by bool_or(r.priority = 'high') desc, min(r.created_at) asc
        limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from (select 1 from reports r where ${condition} group by r.target_type, r.target_id ${having}) x`),
    ]);
    const previews = await this.previews(rows.rows.map((r) => ({ type: r.target_type as string, id: r.target_id as string })));
    return {
      items: rows.rows.map((r) => ({
        target: previews.get(`${r.target_type}:${r.target_id}`) ?? { type: r.target_type as string, id: r.target_id as string, title: '—', excerpt: null, status: 'gone', link: null, owner: null },
        reports: Number(r.reports),
        reporters: Number(r.reporters),
        reasons: r.reasons as string[],
        urgent: r.urgent === true,
        status: r.status as string,
        assignee: (r.assignee as string | null) ?? null,
        notes: (r.notes as Array<{ reason: string; details: string; at: string }>).slice(0, 5),
        firstAt: new Date(r.first_at as string).toISOString(),
        lastAt: new Date(r.last_at as string).toISOString(),
      })),
      meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  async startReview(actorId: string, type: string, id: string) {
    const updated = await this.db
      .update(reports)
      .set({ status: 'under_review', assignedTo: actorId, updatedAt: new Date() })
      .where(and(eq(reports.targetType, type), eq(reports.targetId, id), inArray(reports.status, [...OPEN])))
      .returning({ id: reports.id });
    if (!updated.length) throw AppException.notFound('Report');
    return { status: 'under_review' as const };
  }

  // ------------------------------------------------------------------ decisions

  /** Hides a piece of content (and keeps derived numbers right). */
  async hide(tx: DbOrTx, type: string, id: string): Promise<void> {
    if (type === 'user') return;
    if (type === 'product') {
      const [p] = await tx.execute<{ book_id: string | null; seller_id: string }>(sql`update products set status = 'suspended', updated_at = now() where id = ${id} returning book_id, seller_id`).then((r) => r.rows);
      if (p?.book_id) await refreshBookOffers(tx, [p.book_id]);
      if (p) await refreshStoreProductCounts(tx, [p.seller_id]);
      return;
    }
    if (type === 'store') {
      await tx.execute(sql`update sellers set status = 'suspended', suspended_at = now(), status_reason = 'moderation' where id = (select seller_id from seller_stores where id = ${id})`);
      return;
    }
    const table = CONTENT[type];
    if (!table) throw AppException.badRequest('api.moderation.cannotRemove');
    await tx.execute(sql`update ${sql.raw(table)} set status = 'removed' where id = ${id}`);
    await this.afterContentChange(tx, type, id);
  }

  /** Puts content back after a decision is reverted (or a report is dismissed). */
  async restore(tx: DbOrTx, type: string, id: string): Promise<void> {
    if (type === 'user') return;
    if (type === 'product') {
      const [p] = await tx.execute<{ book_id: string | null; seller_id: string }>(sql`update products set status = 'active', updated_at = now() where id = ${id} and status = 'suspended' returning book_id, seller_id`).then((r) => r.rows);
      if (p?.book_id) await refreshBookOffers(tx, [p.book_id]);
      if (p) await refreshStoreProductCounts(tx, [p.seller_id]);
      return;
    }
    if (type === 'store') {
      await tx.execute(sql`update sellers set status = 'active', suspended_at = null, status_reason = null where id = (select seller_id from seller_stores where id = ${id}) and status = 'suspended'`);
      return;
    }
    const table = CONTENT[type];
    if (!table) return;
    await tx.execute(sql`update ${sql.raw(table)} set status = 'published' where id = ${id} and status in ('removed', 'pending_review', 'hidden')`);
    await this.afterContentChange(tx, type, id);
  }

  private async afterContentChange(tx: DbOrTx, type: string, id: string) {
    if (type === 'review') {
      const [r] = await tx.execute<{ book_id: string | null; product_id: string | null; seller_id: string | null }>(sql`select book_id, product_id, seller_id from reviews where id = ${id}`).then((x) => x.rows);
      if (r) await refreshRatings(tx, { bookIds: r.book_id ? [r.book_id] : [], productIds: r.product_id ? [r.product_id] : [], sellerIds: r.seller_id ? [r.seller_id] : [] });
    }
    if (type === 'comment') {
      await tx.execute(sql`update posts p set comment_count = (select count(*) from comments c where c.post_id = p.id and c.status = 'published') where p.id = (select post_id from comments where id = ${id})`);
    }
  }

  /** Applies an account-level measure. Returns when it ends (null = permanent / not timed). */
  private async applyToAccount(tx: DbOrTx, actorId: string, userId: string, action: ModerationAction, days: number | undefined, scope: RestrictionScope, reason: string, actionId: string): Promise<Date | null> {
    const until = days ? new Date(Date.now() + days * 86_400_000) : null;
    if (action === 'temporary_restriction') {
      await tx.insert(userRestrictions).values({ userId, scope, reason, until, actionId, createdBy: actorId });
    } else if (action === 'suspension') {
      await tx.update(users).set({ status: 'suspended', suspendedUntil: until }).where(eq(users.id, userId));
    } else if (action === 'ban') {
      await tx.update(users).set({ status: 'banned', suspendedUntil: null }).where(eq(users.id, userId));
    }
    return until;
  }

  /**
   * Decides every open report about one target. `no_action` dismisses them (and un-hides content
   * that reports had auto-hidden); anything else is recorded as an action on the target's owner.
   */
  async decide(actorId: string, type: string, id: string, input: Decision) {
    const preview = (await this.previews([{ type, id }])).get(`${type}:${id}`);
    if (!preview) throw AppException.notFound();
    const ownerId = preview.owner?.id ?? null;
    const accountLevel = ['temporary_restriction', 'suspension', 'ban'].includes(input.action);
    if (accountLevel && !ownerId) throw AppException.badRequest('api.moderation.noOwner');
    if (accountLevel && ownerId === actorId) throw AppException.badRequest('api.moderation.notYourself');
    if (input.action === 'content_removal' && type === 'user') throw AppException.badRequest('api.moderation.cannotRemove');

    const result = await this.db.transaction(async (tx) => {
      const open = await tx
        .select({ id: reports.id, reporterId: reports.reporterId })
        .from(reports)
        .where(and(eq(reports.targetType, type), eq(reports.targetId, id), inArray(reports.status, [...OPEN])))
        .for('update');
      const [action] = await tx
        .insert(moderationActions)
        .values({ reportId: open[0]?.id ?? null, targetType: type, targetId: id, targetUserId: ownerId, action: input.action, reason: input.reason, actorId })
        .returning({ id: moderationActions.id });
      let until: Date | null = null;
      if (input.action === 'content_removal') await this.hide(tx, type, id);
      else if (input.action === 'no_action') await this.restore(tx, type, id);
      else if (accountLevel) until = await this.applyToAccount(tx, actorId, ownerId!, input.action, input.durationDays, input.scope, input.reason, action!.id);
      if (until) await tx.update(moderationActions).set({ expiresAt: until }).where(eq(moderationActions.id, action!.id));
      if (open.length) {
        await tx
          .update(reports)
          .set({ status: input.action === 'no_action' ? 'dismissed' : 'action_taken', resolutionNote: input.reason, resolvedAt: new Date(), assignedTo: sql`coalesce(${reports.assignedTo}, ${actorId}::uuid)`, updatedAt: new Date() })
          .where(inArray(reports.id, open.map((r) => r.id)));
      }
      await this.audit.record({ action: `moderation.${input.action}`, entityType: type, entityId: id, actorId, after: { reason: input.reason, ownerId, until, scope: accountLevel ? input.scope : undefined, reports: open.length } }, tx);
      return { actionId: action!.id, until, reporters: [...new Set(open.map((r) => r.reporterId).filter((x): x is string => !!x))] };
    });

    if (ownerId && (input.action === 'suspension' || input.action === 'ban')) await this.sessions.revokeAll(ownerId, `moderation_${input.action}`);
    if (ownerId && input.action !== 'no_action') {
      await this.notifications
        .notify(ownerId, { type: 'moderation', titleKey: `api.moderation.${input.action}Title`, bodyKey: `api.moderation.${input.action}Body`, params: { reason: input.reason, until: result.until ?? '', what: preview.title.slice(0, 60) }, link: '/account/standing' })
        .catch(() => undefined);
    }
    for (const reporterId of result.reporters) {
      await this.notifications
        .notify(reporterId, { type: 'moderation', titleKey: 'api.moderation.reviewedTitle', bodyKey: input.action === 'no_action' ? 'api.moderation.reviewedNoAction' : 'api.moderation.reviewedAction', params: { what: preview.title.slice(0, 60) } })
        .catch(() => undefined);
    }
    return { actionId: result.actionId, action: input.action, until: result.until?.toISOString() ?? null };
  }

  /** Undoes a decision: content back, restriction lifted, account active again. */
  async revert(actorId: string, actionId: string, reason: string) {
    const [action] = await this.db.select().from(moderationActions).where(eq(moderationActions.id, actionId));
    if (!action) throw AppException.notFound('Action');
    if (action.revertedAt) throw AppException.conflict('api.moderation.alreadyReverted');
    await this.db.transaction(async (tx) => {
      if (action.action === 'content_removal') await this.restore(tx, action.targetType, action.targetId);
      if (action.action === 'temporary_restriction') await tx.update(userRestrictions).set({ liftedAt: new Date() }).where(eq(userRestrictions.actionId, action.id));
      if ((action.action === 'suspension' || action.action === 'ban') && action.targetUserId) {
        await tx.update(users).set({ status: 'active', suspendedUntil: null }).where(and(eq(users.id, action.targetUserId), inArray(users.status, ['suspended', 'banned'])));
      }
      await tx.update(moderationActions).set({ revertedAt: new Date() }).where(eq(moderationActions.id, action.id));
      await this.audit.record({ action: 'moderation.revert', entityType: action.targetType, entityId: action.targetId, actorId, before: { action: action.action }, after: { reason } }, tx);
    });
    if (action.targetUserId && action.action !== 'no_action' && action.action !== 'warning') {
      await this.notifications.notify(action.targetUserId, { type: 'moderation', titleKey: 'api.moderation.revertedTitle', bodyKey: 'api.moderation.revertedBody', params: { reason } }).catch(() => undefined);
    }
    return { reverted: true };
  }

  // ------------------------------------------------------------------ held content

  /** Posts, comments and club posts waiting for a moderator (held by the risk check or by reports). */
  async held(type: 'post' | 'comment' | 'club_post', page: number, pageSize: number) {
    const table = CONTENT[type]!;
    const [rows, total] = await Promise.all([
      this.db.execute<{ id: string }>(sql`select id from ${sql.raw(table)} where status = 'pending_review' order by created_at asc limit ${pageSize} offset ${(page - 1) * pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.raw(table)} where status = 'pending_review'`),
    ]);
    const previews = await this.previews(rows.rows.map((r) => ({ type, id: r.id })));
    return { items: rows.rows.map((r) => previews.get(`${type}:${r.id}`)!).filter(Boolean), meta: { page, pageSize, total: total.rows[0]?.n ?? 0 } };
  }

  async approveHeld(actorId: string, type: 'post' | 'comment' | 'club_post', id: string) {
    await this.db.transaction(async (tx) => {
      const updated = await tx.execute(sql`update ${sql.raw(CONTENT[type]!)} set status = 'published' where id = ${id} and status = 'pending_review' returning id`);
      if (!updated.rows.length) throw AppException.notFound();
      await this.afterContentChange(tx, type, id);
      // Reports that held it are answered by the approval.
      await tx.update(reports).set({ status: 'dismissed', resolutionNote: 'approved', resolvedAt: new Date(), updatedAt: new Date() }).where(and(eq(reports.targetType, type), eq(reports.targetId, id), inArray(reports.status, [...OPEN])));
      await this.audit.record({ action: 'moderation.approve', entityType: type, entityId: id, actorId }, tx);
    });
    return { status: 'published' as const };
  }

  // ------------------------------------------------------------------ history

  /** Every decision about a person (for their admin page and their own "account standing"). */
  async historyFor(userId: string, includeActor = true) {
    const rows = await this.db.execute<Row>(sql`
      select a.id, a.action::text as action, a.reason, a.target_type, a.target_id, a.expires_at, a.reverted_at, a.created_at, u.display_name as actor
      from moderation_actions a left join users u on u.id = a.actor_id where a.target_user_id = ${userId} order by a.created_at desc limit 100`);
    const restrictions = await this.db.execute<Row>(sql`
      select scope, reason, until, created_at from user_restrictions where user_id = ${userId} and lifted_at is null and (until is null or until > now()) order by created_at desc`);
    return {
      actions: rows.rows.map((r) => ({
        id: r.id as string,
        action: r.action as ModerationAction,
        reason: r.reason as string,
        targetType: r.target_type as string,
        expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
        revertedAt: r.reverted_at ? new Date(r.reverted_at as string).toISOString() : null,
        createdAt: new Date(r.created_at as string).toISOString(),
        ...(includeActor ? { actor: (r.actor as string | null) ?? null } : {}),
      })),
      restrictions: restrictions.rows.map((r) => ({ scope: r.scope as string, reason: (r.reason as string | null) ?? null, until: r.until ? new Date(r.until as string).toISOString() : null, since: new Date(r.created_at as string).toISOString() })),
    };
  }

  /** Staff changing an account's status directly (from the user's admin page). */
  async setAccountStatus(actorId: string, userId: string, input: { status: 'active' | 'suspended' | 'banned'; reason: string; days?: number }) {
    if (userId === actorId) throw AppException.badRequest('api.moderation.notYourself');
    const [user] = await this.db.select({ id: users.id, status: users.status }).from(users).where(eq(users.id, userId));
    if (!user || user.status === 'deleted') throw AppException.notFound('User');
    if (input.status === 'active') {
      await this.db.transaction(async (tx) => {
        await tx.update(users).set({ status: 'active', suspendedUntil: null }).where(eq(users.id, userId));
        await tx.update(moderationActions).set({ revertedAt: new Date() }).where(and(eq(moderationActions.targetUserId, userId), inArray(moderationActions.action, ['suspension', 'ban']), sql`${moderationActions.revertedAt} is null`));
        await this.audit.record({ action: 'user.reactivate', entityType: 'user', entityId: userId, actorId, before: { status: user.status }, after: { reason: input.reason } }, tx);
      });
      await this.notifications.notify(userId, { type: 'moderation', titleKey: 'api.moderation.revertedTitle', bodyKey: 'api.moderation.revertedBody', params: { reason: input.reason } }).catch(() => undefined);
      return { status: 'active' as const };
    }
    const action = input.status === 'suspended' ? 'suspension' : 'ban';
    const result = await this.decide(actorId, 'user', userId, { action, reason: input.reason, durationDays: input.days, scope: 'all' });
    return { status: input.status, until: result.until };
  }

  /** Report counts per state, for the admin overview. */
  async counts(): Promise<{ open: number; urgent: number; held: number }> {
    const [r] = await this.db
      .execute<{ open: number; urgent: number; held: number }>(sql`
        select (select count(distinct (target_type, target_id))::int from reports where status in ('reported', 'under_review')) as open,
          (select count(distinct (target_type, target_id))::int from reports where status in ('reported', 'under_review') and priority = 'high') as urgent,
          ((select count(*) from posts where status = 'pending_review') + (select count(*) from comments where status = 'pending_review') + (select count(*) from book_club_posts where status = 'pending_review'))::int as held`)
      .then((x) => x.rows);
    return { open: r?.open ?? 0, urgent: r?.urgent ?? 0, held: r?.held ?? 0 };
  }
}
