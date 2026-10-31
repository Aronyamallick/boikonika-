import { Inject, Injectable } from '@nestjs/common';
import { challengeParticipants, type Database, type DbOrTx, readingChallenges, userBadges, users } from '@boikonika/database';
import { and, eq, sql } from 'drizzle-orm';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';

type Row = Record<string, unknown>;
/** Minutes of reading that make a day count towards day challenges (and daily XP). */
export const DAY_MINUTES = 10;

/** Books finished since joining that match a challenge's genre/language filter. */
function booksSql(userId: string, since: unknown, genreKey: string | null, language: string | null) {
  return sql`
    select count(*)::int from reading_progress rp join books b on b.id = rp.book_id
    where rp.user_id = ${userId} and rp.finished_at >= ${since}
      ${language ? sql`and b.language = ${language}` : sql``}
      ${genreKey ? sql`and exists (select 1 from book_categories bc join categories c on c.id = bc.category_id where bc.book_id = b.id and c.path ~ ('(^|/)' || ${genreKey.replace(/_/g, '-')} || '($|/)'))` : sql``}`;
}

/**
 * Reading challenges. Progress is always recomputed from the reader's real activity since they
 * joined (reading days, pages, minutes, finished books), so it cannot drift or be inflated.
 */
@Injectable()
export class ChallengesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly gamification: GamificationService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  private progressSql(userId: string, c: Row) {
    const since = sql`${c.joined_at}::timestamptz`;
    const sinceDay = sql`(${c.joined_at}::timestamptz at time zone 'Asia/Dhaka')::date`;
    switch (c.type) {
      case 'days':
        // Days in a row with at least ten minutes of reading (the longest run since joining).
        return sql`
          with d as (select local_date as day from reading_sessions where user_id = ${userId} and local_date >= ${sinceDay} group by local_date having sum(minutes) >= ${DAY_MINUTES}),
          g as (select day - (row_number() over (order by day))::int as grp from d)
          select coalesce(max(n), 0)::int from (select count(*) as n from g group by grp) runs`;
      case 'pages':
        return sql`select coalesce(sum(pages), 0)::int from reading_sessions where user_id = ${userId} and created_at >= ${since}`;
      case 'minutes':
        return sql`select coalesce(sum(minutes), 0)::int from reading_sessions where user_id = ${userId} and created_at >= ${since}`;
      default:
        return booksSql(userId, since, (c.genre_key as string | null) ?? null, (c.language as string | null) ?? null);
    }
  }

  /** Re-measures the reader's active challenges and completes the ones they reached. */
  async refresh(userId: string, tx: DbOrTx = this.db): Promise<string[]> {
    const active = await tx.execute<Row>(sql`
      select cp.challenge_id, cp.joined_at, cp.deadline_at, c.slug, c.type, c.target, c.genre_key, c.language, c.xp_reward, c.badge_id, c.title
      from challenge_participants cp join reading_challenges c on c.id = cp.challenge_id
      where cp.user_id = ${userId} and cp.status = 'active' and (cp.deadline_at is null or cp.deadline_at > now())`);
    const completed: string[] = [];
    for (const c of active.rows) {
      const [{ progress } = { progress: 0 }] = await tx.execute<{ progress: number }>(sql`select (${this.progressSql(userId, c)}) as progress`).then((r) => r.rows);
      const done = Number(progress) >= Number(c.target);
      await tx
        .update(challengeParticipants)
        .set({ progress: Number(progress), ...(done ? { status: 'completed' as const, completedAt: new Date() } : {}) })
        .where(and(eq(challengeParticipants.challengeId, c.challenge_id as string), eq(challengeParticipants.userId, userId)));
      if (!done) continue;
      completed.push(c.slug as string);
      if (Number(c.xp_reward)) await this.gamification.award(tx, userId, 'challenge', c.challenge_id as string, Number(c.xp_reward));
      if (c.badge_id) await tx.insert(userBadges).values({ userId, badgeId: c.badge_id as string }).onConflictDoNothing();
      const [owner] = await tx.select({ locale: users.locale }).from(users).where(eq(users.id, userId));
      const title = (c.title as Record<string, string>)[owner?.locale === 'en' ? 'en' : 'bn'] ?? (c.slug as string);
      await this.notifications
        .notify(userId, { type: 'reading_challenge', titleKey: 'api.reading.challengeDoneTitle', bodyKey: 'api.reading.challengeDoneBody', params: { challenge: title }, link: `/challenges/${c.slug}` }, tx)
        .catch(() => undefined);
    }
    return completed;
  }

  async list(viewerId?: string) {
    const rows = await this.db.execute<Row>(sql`
      select c.*, cp.progress, cp.status as my_status, cp.joined_at, cp.deadline_at, cp.completed_at
      from reading_challenges c
      left join challenge_participants cp on cp.challenge_id = c.id and cp.user_id = ${viewerId ?? null}
      where c.is_active and (c.ends_at is null or c.ends_at > now())
      order by c.duration_days nulls last, c.target`);
    return rows.rows.map((r) => this.view(r));
  }

  async detail(slug: string, viewerId?: string) {
    const rows = await this.db.execute<Row>(sql`
      select c.*, cp.progress, cp.status as my_status, cp.joined_at, cp.deadline_at, cp.completed_at
      from reading_challenges c
      left join challenge_participants cp on cp.challenge_id = c.id and cp.user_id = ${viewerId ?? null}
      where c.slug = ${slug} and c.is_active`);
    const row = rows.rows[0];
    if (!row) throw AppException.notFound('Challenge');
    const finishers = await this.db.execute<Row>(sql`
      select u.username, u.display_name, up.avatar_key, cp.completed_at from challenge_participants cp
      join users u on u.id = cp.user_id left join user_profiles up on up.user_id = u.id
      where cp.challenge_id = ${row.id} and cp.status = 'completed' and u.status = 'active'
      order by cp.completed_at desc limit 12`);
    const [{ completed } = { completed: 0 }] = await this.db
      .execute<{ completed: number }>(sql`select count(*)::int as completed from challenge_participants where challenge_id = ${row.id} and status = 'completed'`)
      .then((r) => r.rows);
    return { ...this.view(row), completedCount: Number(completed), recentFinishers: finishers.rows.map((f) => ({ username: f.username as string, name: f.display_name as string, avatarUrl: this.storage.publicUrl(f.avatar_key as string | null), completedAt: new Date(f.completed_at as string).toISOString() })) };
  }

  /** Joining (or re-joining after giving up or running out of time) starts the clock again. */
  async join(userId: string, slug: string) {
    return this.db.transaction(async (tx) => {
      const [challenge] = await tx.select().from(readingChallenges).where(and(eq(readingChallenges.slug, slug), eq(readingChallenges.isActive, true)));
      if (!challenge || (challenge.endsAt && challenge.endsAt < new Date())) throw AppException.notFound('Challenge');
      const [existing] = await tx.select().from(challengeParticipants).where(and(eq(challengeParticipants.challengeId, challenge.id), eq(challengeParticipants.userId, userId)));
      if (existing?.status === 'completed') throw new AppException('CONFLICT', 'api.reading.challengeAlreadyDone');
      if (existing?.status === 'active' && (!existing.deadlineAt || existing.deadlineAt > new Date())) throw new AppException('CONFLICT', 'api.reading.challengeJoined');
      const now = new Date();
      const durationEnd = challenge.durationDays ? new Date(now.getTime() + challenge.durationDays * 86_400_000) : null;
      const deadline = durationEnd && challenge.endsAt ? new Date(Math.min(durationEnd.getTime(), challenge.endsAt.getTime())) : (durationEnd ?? challenge.endsAt);
      await tx
        .insert(challengeParticipants)
        .values({ challengeId: challenge.id, userId, joinedAt: now, deadlineAt: deadline, progress: 0, status: 'active' })
        .onConflictDoUpdate({ target: [challengeParticipants.challengeId, challengeParticipants.userId], set: { joinedAt: now, deadlineAt: deadline, progress: 0, status: 'active', completedAt: null } });
      if (!existing) await tx.update(readingChallenges).set({ participantCount: sql`${readingChallenges.participantCount} + 1` }).where(eq(readingChallenges.id, challenge.id));
      return { slug, deadlineAt: deadline?.toISOString() ?? null };
    });
  }

  async leave(userId: string, slug: string): Promise<void> {
    const result = await this.db.execute(sql`
      update challenge_participants cp set status = 'abandoned' from reading_challenges c
      where c.id = cp.challenge_id and c.slug = ${slug} and cp.user_id = ${userId} and cp.status = 'active'`);
    if (!result.rowCount) throw AppException.notFound('Challenge');
  }

  private view(r: Row) {
    const deadline = r.deadline_at ? new Date(r.deadline_at as string) : null;
    const status = r.my_status as string | null;
    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as Record<string, string>,
      description: r.description as Record<string, string>,
      type: r.type as string,
      target: Number(r.target),
      durationDays: r.duration_days === null ? null : Number(r.duration_days),
      genreKey: (r.genre_key as string | null) ?? null,
      language: (r.language as string | null) ?? null,
      xpReward: Number(r.xp_reward ?? 0),
      participantCount: Number(r.participant_count ?? 0),
      endsAt: r.ends_at ? new Date(r.ends_at as string).toISOString() : null,
      mine: status
        ? {
            // An active challenge past its deadline has simply run out of time.
            status: status === 'active' && deadline && deadline < new Date() ? 'expired' : status,
            progress: Number(r.progress ?? 0),
            joinedAt: new Date(r.joined_at as string).toISOString(),
            deadlineAt: deadline?.toISOString() ?? null,
            completedAt: r.completed_at ? new Date(r.completed_at as string).toISOString() : null,
          }
        : null,
    };
  }
}
