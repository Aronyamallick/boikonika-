import { Inject, Injectable } from '@nestjs/common';
import { systemSettings, type Database } from '@boikonika/database';
import { SETTINGS_CATALOG, type SettingKey } from '@boikonika/shared';
import { inArray, sql } from 'drizzle-orm';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { CopyrightService } from '../moderation/copyright.service';
import { ModerationAdminService } from '../moderation/moderation-admin.service';
import { SettingsService } from '../settings/settings.service';

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
const pct = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 1000) / 10 : null);
/** Orders that count as sales: placed and paid (cash on delivery once collected). */
const SOLD = sql`o.status <> 'cancelled' and o.payment_status in ('paid', 'partially_refunded')`;

/**
 * The staff dashboard: platform health at a glance, analytics without personal data (counts and
 * rankings only), people, the audit trail and the settings staff may change.
 */
@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly moderation: ModerationAdminService,
    private readonly copyright: CopyrightService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ overview & analytics

  async overview(days: number) {
    const period = sql`now() - make_interval(days => ${days})`;
    const previous = sql`now() - make_interval(days => ${days * 2})`;
    const [totals] = await this.db
      .execute<Row>(sql`
        select
          (select count(*) from users where deleted_at is null) as users,
          (select count(*) from users where deleted_at is null and created_at > ${period}) as new_users,
          (select count(*) from users where deleted_at is null and created_at > ${previous} and created_at <= ${period}) as new_users_prev,
          (select count(distinct user_id) from user_activity_days where day = (now() at time zone 'Asia/Dhaka')::date) as dau,
          (select count(distinct user_id) from user_activity_days where day > (now() at time zone 'Asia/Dhaka')::date - 7) as wau,
          (select count(distinct user_id) from user_activity_days where day > (now() at time zone 'Asia/Dhaka')::date - 30) as mau,
          (select count(*) from authors where user_id is not null) as authors,
          (select count(*) from sellers where status = 'active') as sellers,
          (select count(*) from publishers where is_verified) as publishers,
          (select count(*) from books where status = 'published' and deleted_at is null) as books,
          (select count(*) from products where status = 'active' and deleted_at is null) as products,
          (select count(*) from orders o where o.placed_at > ${period} and o.status <> 'cancelled') as orders,
          (select count(*) from orders o where o.placed_at > ${previous} and o.placed_at <= ${period} and o.status <> 'cancelled') as orders_prev,
          (select coalesce(sum(o.grand_total - o.refunded_total), 0) from orders o where ${SOLD} and o.paid_at > ${period}) as revenue,
          (select coalesce(sum(o.grand_total - o.refunded_total), 0) from orders o where ${SOLD} and o.paid_at > ${previous} and o.paid_at <= ${period}) as revenue_prev,
          (select coalesce(sum(so.commission_amount), 0) from seller_orders so where so.status = 'delivered' and so.delivered_at > ${period}) as commission,
          -- Buyers among the people active in the period, so the share can't pass 100% (activity is tracked per day).
          (select count(distinct o.user_id) from orders o where ${SOLD} and o.paid_at > ${period}
            and exists (select 1 from user_activity_days a where a.user_id = o.user_id and a.day > (now() at time zone 'Asia/Dhaka')::date - ${days}::int)) as buyers,
          (select count(distinct user_id) from user_activity_days where day > (now() at time zone 'Asia/Dhaka')::date - ${days}::int) as active_in_period,
          (select count(*) from kyc_verifications where status in ('pending', 'under_review')) as pending_kyc,
          (select count(*) from refunds where status in ('requested', 'approved', 'processing')) as open_refunds,
          (select count(*) from products where status = 'pending_review' and deleted_at is null) as pending_listings`)
      .then((r) => r.rows);
    const [moderation, copyright, series, books, authors, searches, categories] = await Promise.all([
      this.moderation.counts(),
      this.copyright.openCount(),
      this.db.execute<Row>(sql`
        with d as (select generate_series((now() at time zone 'Asia/Dhaka')::date - ${days - 1}::int, (now() at time zone 'Asia/Dhaka')::date, interval '1 day')::date as day)
        select d.day::text as day,
          (select count(*) from users u where (u.created_at at time zone 'Asia/Dhaka')::date = d.day and u.deleted_at is null)::int as signups,
          (select count(distinct a.user_id) from user_activity_days a where a.day = d.day)::int as active,
          (select count(*) from orders o where (o.placed_at at time zone 'Asia/Dhaka')::date = d.day and o.status <> 'cancelled')::int as orders,
          (select coalesce(sum(o.grand_total - o.refunded_total), 0) from orders o where ${SOLD} and (o.paid_at at time zone 'Asia/Dhaka')::date = d.day)::float as revenue
        from d order by d.day`),
      this.db.execute<Row>(sql`
        select b.slug, b.title, b.cover_key, coalesce(sum(s.sales), 0)::int as sales, coalesce(sum(s.views), 0)::int as views
        from book_daily_stats s join books b on b.id = s.book_id where s.day > ${period} and b.deleted_at is null
        group by b.id order by sum(s.sales) desc, sum(s.views) desc limit 10`),
      this.db.execute<Row>(sql`
        select a.slug, a.name, coalesce(sum(s.sales), 0)::int as sales, a.follower_count
        from book_daily_stats s join book_authors ba on ba.book_id = s.book_id and ba.role = 'author' join authors a on a.id = ba.author_id
        where s.day > ${period} group by a.id order by sum(s.sales) desc, a.follower_count desc limit 10`),
      this.db.execute<Row>(sql`select display, count, result_count from search_queries order by count desc, last_searched_at desc limit 10`),
      this.db.execute<Row>(sql`
        select c.slug, c.path, c.name, coalesce(sum(s.sales), 0)::int as sales, coalesce(sum(s.views), 0)::int as views
        from book_daily_stats s join books b on b.id = s.book_id join categories c on c.id = b.primary_category_id
        where s.day > ${period} group by c.id order by sum(s.sales) desc, sum(s.views) desc limit 10`),
    ]);
    const t = totals ?? {};
    return {
      days,
      kpis: {
        users: n(t.users),
        newUsers: { value: n(t.new_users), change: pct(n(t.new_users), n(t.new_users_prev)) },
        dau: n(t.dau),
        wau: n(t.wau),
        mau: n(t.mau),
        stickiness: n(t.mau) ? Math.round((n(t.dau) / n(t.mau)) * 1000) / 10 : null,
        authors: n(t.authors),
        sellers: n(t.sellers),
        publishers: n(t.publishers),
        books: n(t.books),
        products: n(t.products),
        orders: { value: n(t.orders), change: pct(n(t.orders), n(t.orders_prev)) },
        revenue: { value: Number(t.revenue ?? 0).toFixed(2), change: pct(Number(t.revenue ?? 0), Number(t.revenue_prev ?? 0)) },
        commission: Number(t.commission ?? 0).toFixed(2),
        conversion: n(t.active_in_period) ? Math.round((n(t.buyers) / n(t.active_in_period)) * 1000) / 10 : null,
      },
      queues: {
        pendingKyc: n(t.pending_kyc),
        openRefunds: n(t.open_refunds),
        pendingListings: n(t.pending_listings),
        openReports: moderation.open,
        urgentReports: moderation.urgent,
        heldContent: moderation.held,
        copyrightClaims: copyright,
      },
      series: series.rows.map((r) => ({ day: r.day as string, signups: n(r.signups), active: n(r.active), orders: n(r.orders), revenue: Number(r.revenue ?? 0) })),
      popular: {
        books: books.rows.map((r) => ({ slug: r.slug as string, title: r.title as string, coverUrl: this.storage.publicUrl(r.cover_key as string | null), sales: n(r.sales), views: n(r.views) })),
        authors: authors.rows.map((r) => ({ slug: r.slug as string, name: r.name as string, sales: n(r.sales), followers: n(r.follower_count) })),
        searches: searches.rows.map((r) => ({ query: r.display as string, count: n(r.count), results: n(r.result_count) })),
        categories: categories.rows.map((r) => ({ slug: r.slug as string, path: r.path as string, name: r.name as Record<string, string>, sales: n(r.sales), views: n(r.views) })),
      },
    };
  }

  // ------------------------------------------------------------------ people

  async users(q: { q?: string; role?: string; status?: string; page: number; pageSize: number }) {
    const where = [sql`u.deleted_at is null`];
    if (q.status) where.push(sql`u.status = ${q.status}`);
    if (q.role) where.push(sql`exists (select 1 from user_roles r where r.user_id = u.id and r.role = ${q.role})`);
    if (q.q) {
      const like = `%${q.q.replace(/[%_\\]/g, '')}%`;
      const digits = q.q.replace(/\D/g, '');
      where.push(sql`(u.display_name ilike ${like} or u.username ilike ${like} or u.email ilike ${like} ${digits.length >= 4 ? sql`or u.phone like ${`%${digits.slice(-10)}%`}` : sql``})`);
    }
    const condition = sql.join(where, sql` and `);
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select u.id, u.display_name, u.username, u.email, u.phone, u.status, u.created_at, p.avatar_key,
          array(select r.role::text from user_roles r where r.user_id = u.id order by r.role) as roles,
          (select max(a.day) from user_activity_days a where a.user_id = u.id)::text as last_active,
          (select count(*) from reports r where r.target_user_id = u.id and r.status in ('reported', 'under_review'))::int as open_reports
        from users u left join user_profiles p on p.user_id = u.id
        where ${condition} order by u.created_at desc limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from users u where ${condition}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: r.id as string,
        name: r.display_name as string,
        username: (r.username as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        phone: (r.phone as string | null) ?? null,
        status: r.status as string,
        roles: r.roles as string[],
        avatarUrl: this.storage.publicUrl(r.avatar_key as string | null),
        lastActive: (r.last_active as string | null) ?? null,
        openReports: n(r.open_reports),
        joinedAt: new Date(r.created_at as string).toISOString(),
      })),
      meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  async user(actorId: string, id: string) {
    const [u] = await this.db
      .execute<Row>(sql`
        select u.*, p.avatar_key, p.bio, p.location, p.institution,
          array(select r.role::text from user_roles r where r.user_id = u.id order by r.role) as roles,
          (select max(a.day) from user_activity_days a where a.user_id = u.id)::text as last_active,
          (select count(*) from orders o where o.user_id = u.id)::int as orders,
          (select coalesce(sum(o.grand_total - o.refunded_total), 0) from orders o where o.user_id = u.id and ${SOLD}) as spent,
          (select count(*) from posts x where x.author_id = u.id)::int as posts,
          (select count(*) from reviews x where x.user_id = u.id)::int as reviews,
          (select count(*) from reports x where x.reporter_id = u.id)::int as reports_filed,
          (select count(*) from reports x where x.target_user_id = u.id)::int as reports_against,
          (select count(*) from sessions x where x.user_id = u.id and x.revoked_at is null and x.expires_at > now())::int as sessions,
          (select json_build_object('status', se.status, 'store', st.slug, 'name', st.name) from sellers se left join seller_stores st on st.seller_id = se.id where se.user_id = u.id) as seller,
          (select a.slug from authors a where a.user_id = u.id limit 1) as author_slug,
          (select pu.slug from publishers pu where pu.owner_id = u.id limit 1) as publisher_slug,
          (select k.status::text from kyc_verifications k where k.user_id = u.id order by k.created_at desc limit 1) as kyc_status
        from users u left join user_profiles p on p.user_id = u.id where u.id = ${id}`)
      .then((r) => r.rows);
    if (!u || u.deleted_at) throw AppException.notFound('User');
    // Looking at someone's contact details and history is itself recorded.
    await this.audit.record({ action: 'user.view', entityType: 'user', entityId: id, actorId });
    const history = await this.moderation.historyFor(id);
    return {
      id,
      name: u.display_name as string,
      username: (u.username as string | null) ?? null,
      email: (u.email as string | null) ?? null,
      emailVerified: !!u.email_verified_at,
      phone: (u.phone as string | null) ?? null,
      phoneVerified: !!u.phone_verified_at,
      status: u.status as string,
      suspendedUntil: u.suspended_until ? new Date(u.suspended_until as string).toISOString() : null,
      twoFactor: !!u.two_factor_enabled_at,
      locale: u.locale as string,
      avatarUrl: this.storage.publicUrl(u.avatar_key as string | null),
      bio: (u.bio as string | null) ?? null,
      location: (u.location as string | null) ?? null,
      institution: (u.institution as string | null) ?? null,
      roles: u.roles as string[],
      joinedAt: new Date(u.created_at as string).toISOString(),
      lastActive: (u.last_active as string | null) ?? null,
      kycStatus: (u.kyc_status as string | null) ?? null,
      seller: (u.seller as { status: string; store: string | null; name: string | null } | null) ?? null,
      authorSlug: (u.author_slug as string | null) ?? null,
      publisherSlug: (u.publisher_slug as string | null) ?? null,
      stats: { orders: n(u.orders), spent: Number(u.spent ?? 0).toFixed(2), posts: n(u.posts), reviews: n(u.reviews), reportsFiled: n(u.reports_filed), reportsAgainst: n(u.reports_against), sessions: n(u.sessions) },
      moderation: history,
    };
  }

  // ------------------------------------------------------------------ audit trail

  async auditLog(q: { action?: string; entityType?: string; actor?: string; page: number; pageSize: number }) {
    const where = [sql`true`];
    if (q.action) where.push(sql`l.action ilike ${`${q.action.replace(/[%_\\]/g, '')}%`}`);
    if (q.entityType) where.push(sql`l.entity_type = ${q.entityType}`);
    if (q.actor) {
      const like = `%${q.actor.replace(/[%_\\]/g, '')}%`;
      where.push(sql`(u.display_name ilike ${like} or u.username ilike ${like})`);
    }
    const condition = sql.join(where, sql` and `);
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select l.id, l.action, l.entity_type, l.entity_id, l.before, l.after, l.ip, l.created_at, u.display_name, u.username
        from audit_logs l left join users u on u.id = l.actor_id where ${condition}
        order by l.id desc limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from audit_logs l left join users u on u.id = l.actor_id where ${condition}`),
    ]);
    return {
      items: rows.rows.map((r) => ({
        id: n(r.id),
        action: r.action as string,
        entityType: r.entity_type as string,
        entityId: (r.entity_id as string | null) ?? null,
        before: (r.before as Record<string, unknown> | null) ?? null,
        after: (r.after as Record<string, unknown> | null) ?? null,
        ip: (r.ip as string | null) ?? null,
        actor: r.display_name ? { name: r.display_name as string, username: (r.username as string | null) ?? null } : null,
        at: new Date(r.created_at as string).toISOString(),
      })),
      meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  // ------------------------------------------------------------------ settings

  async settingsList() {
    const keys = Object.keys(SETTINGS_CATALOG) as SettingKey[];
    const rows = await this.db.select().from(systemSettings).where(inArray(systemSettings.key, keys));
    return keys.map((key) => {
      const entry = SETTINGS_CATALOG[key];
      const row = rows.find((r) => r.key === key);
      return { key, ...entry, value: (row?.value as number | boolean | undefined) ?? entry.default, updatedAt: row?.updatedAt.toISOString() ?? null };
    });
  }

  async updateSettings(actorId: string, values: Record<string, number | boolean>) {
    const before = Object.fromEntries((await this.settingsList()).map((s) => [s.key, s.value]));
    await this.db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(values)) {
        await tx
          .insert(systemSettings)
          .values({ key, value, updatedBy: actorId })
          .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedBy: actorId, updatedAt: new Date() } });
      }
      await this.audit.record({ action: 'settings.update', entityType: 'settings', actorId, before: Object.fromEntries(Object.keys(values).map((k) => [k, before[k]])), after: values }, tx);
    });
    for (const key of Object.keys(values)) await this.settings.invalidate(key);
    return this.settingsList();
  }
}
