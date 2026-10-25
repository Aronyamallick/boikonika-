import { Inject, Injectable } from '@nestjs/common';
import { badges, type Database, type DbOrTx, userBadges, users, xpEvents } from '@boikonika/database';
import { and, eq, sql } from 'drizzle-orm';
import { DB } from '../../infra/database/database.module';
import { NotificationsService } from '../notifications/notifications.service';

/** XP per activity, and how much of it one user can earn per (Asia/Dhaka) day. */
export const XP_RULES = {
  post: { xp: 5, dailyCap: 25 },
  comment: { xp: 1, dailyCap: 10 },
  post_liked: { xp: 1, dailyCap: 20 },
  review: { xp: 10, dailyCap: 30 },
  // One award per reading day (the day is the source id); sessions can be logged a week back.
  reading_day: { xp: 2, dailyCap: 16 },
  book_completed: { xp: 25, dailyCap: 75 },
  quiz_passed: { xp: 15, dailyCap: 60 },
} as const;
export type XpSource = keyof typeof XP_RULES | 'challenge' | 'badge';

/** Sources that count as community contribution (Top Contributor badge). */
const COMMUNITY_SOURCES = ['post', 'comment', 'post_liked', 'review'];

/** Level n starts at 50·n·(n−1) XP: 0, 100, 300, 600, 1000, … */
export function levelFor(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + Math.max(0, xp) / 12.5)) / 2));
}
export const xpForLevel = (level: number) => 50 * level * (level - 1);

type StatDelta = Partial<Record<'booksCompleted' | 'pagesRead' | 'minutesRead' | 'reviewsWritten' | 'postsPublished' | 'quizzesPassed', number>>;
const STAT_COLUMNS: Record<keyof StatDelta, string> = {
  booksCompleted: 'books_completed',
  pagesRead: 'pages_read',
  minutesRead: 'minutes_read',
  reviewsWritten: 'reviews_written',
  postsPublished: 'posts_published',
  quizzesPassed: 'quizzes_passed',
};

/**
 * XP ledger, levels and badges. XP is idempotent per (user, source, sourceId) and capped per day, so
 * repeating or spamming an action never pays twice; badges are re-checked after activity.
 */
@Injectable()
export class GamificationService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  /** Awards XP once for an activity. Returns the XP granted (0 when repeated or over the daily cap). */
  async award(tx: DbOrTx, userId: string, source: XpSource, sourceId: string, xp?: number): Promise<number> {
    const rule = source in XP_RULES ? XP_RULES[source as keyof typeof XP_RULES] : null;
    let amount = xp ?? rule?.xp ?? 0;
    if (amount <= 0) return 0;
    if (rule) {
      const [{ today } = { today: 0 }] = await tx
        .execute<{ today: number }>(sql`
          select coalesce(sum(xp), 0)::int as today from xp_events
          where user_id = ${userId} and source = ${source} and created_at >= (date_trunc('day', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka')`)
        .then((r) => r.rows);
      amount = Math.min(amount, rule.dailyCap - Number(today));
      if (amount <= 0) return 0;
    }
    const inserted = await tx.insert(xpEvents).values({ userId, source, sourceId, xp: amount }).onConflictDoNothing().returning({ id: xpEvents.id });
    if (!inserted.length) return 0;
    await tx.execute(sql`
      insert into user_stats (user_id, xp_total, level) values (${userId}, ${amount}, 1)
      on conflict (user_id) do update set xp_total = user_stats.xp_total + ${amount}, updated_at = now()`);
    await tx.execute(sql`update user_stats set level = ${sql.raw('greatest(1, floor((1 + sqrt(1 + xp_total / 12.5)) / 2))::smallint')} where user_id = ${userId}`);
    return amount;
  }

  /** Adds to the cached counters on user_stats (never below zero). */
  async bump(tx: DbOrTx, userId: string, delta: StatDelta): Promise<void> {
    const entries = Object.entries(delta).filter(([, v]) => v);
    if (!entries.length) return;
    const sets = entries.map(([k, v]) => sql`${sql.raw(STAT_COLUMNS[k as keyof StatDelta])} = greatest(0, user_stats.${sql.raw(STAT_COLUMNS[k as keyof StatDelta])} + ${v})`);
    const cols = entries.map(([k]) => sql.raw(STAT_COLUMNS[k as keyof StatDelta]));
    const vals = entries.map(([, v]) => sql`${Math.max(0, v as number)}`);
    await tx.execute(sql`
      insert into user_stats (user_id, ${sql.join(cols, sql`, `)}) values (${userId}, ${sql.join(vals, sql`, `)})
      on conflict (user_id) do update set ${sql.join(sets, sql`, `)}, updated_at = now()`);
  }

  /** Every badge criterion, measured from the user's real activity. */
  private async metrics(tx: DbOrTx, userId: string): Promise<Record<string, number>> {
    const [row] = await tx
      .execute<Record<string, number>>(sql`
        select
          coalesce((select books_completed from user_stats where user_id = ${userId}), 0) as "booksCompleted",
          coalesce((select longest_streak from user_stats where user_id = ${userId}), 0) as "readingStreakDays",
          coalesce((select pages_read from user_stats where user_id = ${userId}), 0) as "pagesRead",
          coalesce((select minutes_read from user_stats where user_id = ${userId}), 0) as "minutesRead",
          (select count(distinct split_part(c.path, '/', 2)) from reading_progress rp
             join book_categories bc on bc.book_id = rp.book_id join categories c on c.id = bc.category_id
             where rp.user_id = ${userId} and rp.finished_at is not null)::int as "distinctGenresCompleted",
          (select count(*) from reviews where user_id = ${userId} and status = 'published')::int as "reviewsPublished",
          (select count(*) from posts where author_id = ${userId} and status = 'published' and deleted_at is null and type in ('educational', 'study_tip') and like_count > 0)::int as "educationalPostsWithLikes",
          (select count(*) from posts where author_id = ${userId} and status = 'published' and deleted_at is null and type in ('poem', 'story'))::int as "creativePostsPublished",
          (select count(distinct quiz_id) from quiz_attempts where user_id = ${userId} and passed)::int as "quizzesPassed",
          (select coalesce(sum(xp), 0) from xp_events where user_id = ${userId} and source in (${sql.join(
            COMMUNITY_SOURCES.map((s) => sql`${s}`),
            sql`, `,
          )}))::int as "communityXp",
          (select count(*) from book_club_members where user_id = ${userId} and status = 'active')::int as "clubsJoined",
          (select count(*) from challenge_participants where user_id = ${userId} and status = 'completed')::int as "challengesCompleted"`)
      .then((r) => r.rows);
    return Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v)]));
  }

  /** Awards any badge whose criteria the user now meets (with its XP and a notification). */
  async evaluateBadges(userId: string, tx: DbOrTx = this.db): Promise<string[]> {
    const pending = await tx
      .select({ id: badges.id, key: badges.key, criteria: badges.criteria, xpReward: badges.xpReward, name: badges.name })
      .from(badges)
      // Columns inside a raw subquery are written out with their table: Drizzle leaves them unqualified.
      .where(and(eq(badges.isActive, true), sql`not exists (select 1 from user_badges ub where ub.badge_id = "badges"."id" and ub.user_id = ${userId})`));
    if (!pending.length) return [];
    const metrics = await this.metrics(tx, userId);
    const [owner] = await tx.select({ locale: users.locale }).from(users).where(eq(users.id, userId));
    const lang = owner?.locale === 'en' ? 'en' : 'bn';
    const earned: string[] = [];
    for (const badge of pending) {
      const met = Object.entries(badge.criteria).every(([key, target]) => typeof target === 'number' && (metrics[key] ?? 0) >= target);
      if (!met) continue;
      const inserted = await tx.insert(userBadges).values({ userId, badgeId: badge.id }).onConflictDoNothing().returning();
      if (!inserted.length) continue;
      earned.push(badge.key);
      if (badge.xpReward) await this.award(tx, userId, 'badge', badge.key, badge.xpReward);
      await this.notifications
        .notify(userId, { type: 'reading_challenge', titleKey: 'api.gamification.badgeTitle', bodyKey: 'api.gamification.badgeBody', params: { badge: badge.name[lang] ?? badge.key }, link: '/library?tab=achievements', data: { badge: badge.key } }, tx)
        .catch(() => undefined);
    }
    return earned;
  }

  /** Every active badge with how far the user is towards it (earned ones carry the date). */
  async badgeProgress(userId: string) {
    const [all, earned, metrics] = await Promise.all([
      this.db.select().from(badges).where(eq(badges.isActive, true)).orderBy(badges.xpReward),
      this.db.select({ badgeId: userBadges.badgeId, awardedAt: userBadges.awardedAt }).from(userBadges).where(eq(userBadges.userId, userId)),
      this.metrics(this.db, userId),
    ]);
    const awarded = new Map(earned.map((e) => [e.badgeId, e.awardedAt]));
    return all.map((b) => {
      const [metric, target] = Object.entries(b.criteria)[0] ?? ['', 0];
      const at = awarded.get(b.id);
      return {
        key: b.key,
        icon: b.icon,
        name: b.name,
        description: b.description,
        xpReward: b.xpReward,
        metric,
        target: Number(target),
        current: Math.min(Number(target), metrics[metric] ?? 0),
        earnedAt: at ? at.toISOString() : null,
      };
    });
  }

  /** Level, XP, counters and badges for a profile or the library page. */
  async summary(userId: string) {
    const [stats] = await this.db.execute<Record<string, unknown>>(sql`select * from user_stats where user_id = ${userId}`).then((r) => r.rows);
    const earned = await this.db
      .select({ key: badges.key, icon: badges.icon, name: badges.name, description: badges.description, awardedAt: userBadges.awardedAt })
      .from(userBadges)
      .innerJoin(badges, eq(badges.id, userBadges.badgeId))
      .where(eq(userBadges.userId, userId))
      .orderBy(userBadges.awardedAt);
    const xp = Number(stats?.xp_total ?? 0);
    const level = levelFor(xp);
    return {
      xp,
      level,
      levelStartXp: xpForLevel(level),
      nextLevelXp: xpForLevel(level + 1),
      booksCompleted: Number(stats?.books_completed ?? 0),
      pagesRead: Number(stats?.pages_read ?? 0),
      minutesRead: Number(stats?.minutes_read ?? 0),
      reviewsWritten: Number(stats?.reviews_written ?? 0),
      postsPublished: Number(stats?.posts_published ?? 0),
      quizzesPassed: Number(stats?.quizzes_passed ?? 0),
      currentStreak: Number(stats?.current_streak ?? 0),
      longestStreak: Number(stats?.longest_streak ?? 0),
      lastReadOn: (stats?.last_read_on as string | null) ?? null,
      badges: earned.map((b) => ({ ...b, awardedAt: b.awardedAt.toISOString() })),
    };
  }
}
