import { Inject, Injectable } from '@nestjs/common';
import { competitionEntries, competitions, type Database, events, posts, scholarships, userNotes } from '@boikonika/database';
import { slugify, slugSuffix, type competitionSchema, type educationEventSchema, type entryJudgementSchema, type noteSchema, type noteUpdateSchema, type scholarshipSchema } from '@boikonika/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QuizzesService } from './quizzes.service';

type Row = Record<string, unknown>;
const NOTES_LIMIT = 500;

const slugFor = (title: string) => `${slugify(title, 60)}-${slugSuffix(4)}`;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** Study notes, educational events, competitions and scholarships, and the Student Zone home. */
@Injectable()
export class StudyService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly catalog: CatalogService,
    private readonly quizzes: QuizzesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ home

  async home(viewerId?: string) {
    const [featured, upcoming, open, deadlines, groups, textbooks] = await Promise.all([
      this.quizzes.list({ page: 1, pageSize: 6 }, viewerId).then((r) => r.items),
      this.events({ upcoming: true, limit: 4 }),
      this.competitions({ status: 'open', limit: 3 }),
      this.scholarships({ limit: 4 }),
      this.db.execute<Row>(sql`
        select c.slug, c.name, c.subject, c.member_count, c.institution_name from book_clubs c
        where c.status = 'published' and c.purpose = 'study' order by c.member_count desc, c.created_at desc limit 6`),
      this.catalog.bookCards([sql`(b.student_pick or exists (select 1 from book_categories bc join categories c on c.id = bc.category_id where bc.book_id = b.id and c.path like 'books/academic%'))`], sql`b.student_pick desc, b.sales_count desc`, 12),
    ]);
    return {
      quizzes: featured,
      events: upcoming,
      competitions: open,
      scholarships: deadlines,
      studyGroups: groups.rows.map((g) => ({ slug: g.slug as string, name: g.name as string, subject: (g.subject as string | null) ?? null, memberCount: Number(g.member_count), institutionName: (g.institution_name as string | null) ?? null })),
      textbooks,
    };
  }

  // ------------------------------------------------------------------ notes

  async notes(userId: string, subject?: string) {
    const rows = await this.db.execute<Row>(sql`
      select n.*, b.title as book_title, b.slug as book_slug from user_notes n left join books b on b.id = n.book_id
      where n.user_id = ${userId} ${subject ? sql`and n.subject = ${subject}` : sql``} order by n.updated_at desc limit 200`);
    return rows.rows.map((n) => this.noteView(n));
  }

  private noteView(n: Row) {
    return {
      id: n.id as string,
      title: n.title as string,
      body: n.body as string,
      subject: (n.subject as string | null) ?? null,
      page: n.page === null ? null : Number(n.page),
      visibility: n.visibility as string,
      book: n.book_slug ? { title: n.book_title as string, slug: n.book_slug as string } : null,
      updatedAt: iso(n.updated_at)!,
    };
  }

  async createNote(userId: string, input: z.output<typeof noteSchema>) {
    const [{ n } = { n: 0 }] = await this.db.execute<{ n: number }>(sql`select count(*)::int as n from user_notes where user_id = ${userId}`).then((r) => r.rows);
    if (n >= NOTES_LIMIT) throw new AppException('RATE_LIMITED', 'api.student.tooManyNotes');
    const [row] = await this.db
      .insert(userNotes)
      .values({ userId, title: input.title, body: input.body, subject: input.subject ?? null, bookId: input.bookId ?? null, page: input.page ?? null, visibility: input.visibility })
      .returning({ id: userNotes.id });
    return (await this.notes(userId)).find((x) => x.id === row!.id)!;
  }

  async updateNote(userId: string, id: string, input: z.output<typeof noteUpdateSchema>) {
    const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    const updated = await this.db.update(userNotes).set({ ...changes, updatedAt: new Date() }).where(and(eq(userNotes.id, id), eq(userNotes.userId, userId))).returning({ id: userNotes.id });
    if (!updated.length) throw AppException.notFound('Note');
    return (await this.notes(userId)).find((x) => x.id === id)!;
  }

  async deleteNote(userId: string, id: string): Promise<void> {
    const deleted = await this.db.delete(userNotes).where(and(eq(userNotes.id, id), eq(userNotes.userId, userId))).returning();
    if (!deleted.length) throw AppException.notFound('Note');
  }

  /** A note shared publicly (or with followers, for people who follow its author). */
  async sharedNote(id: string, viewerId?: string) {
    const rows = await this.db.execute<Row>(sql`
      select n.*, b.title as book_title, b.slug as book_slug, u.username, u.display_name from user_notes n join users u on u.id = n.user_id left join books b on b.id = n.book_id
      where n.id = ${id} and u.status = 'active' and (n.visibility = 'public' or n.user_id = ${viewerId ?? null}
        or (n.visibility = 'followers' and exists (select 1 from follows f where f.follower_id = ${viewerId ?? null} and f.target_type = 'user' and f.target_id = n.user_id)))`);
    const row = rows.rows[0];
    if (!row) throw AppException.notFound('Note');
    return { ...this.noteView(row), author: { username: row.username as string, name: row.display_name as string } };
  }

  // ------------------------------------------------------------------ events

  async events(filter: { upcoming?: boolean; audience?: string; limit: number }) {
    const rows = await this.db.execute<Row>(sql`
      select * from events where status = 'published'
        ${filter.upcoming !== false ? sql`and coalesce(ends_at, starts_at) > now()` : sql``}
        ${filter.audience ? sql`and audience in (${filter.audience}, 'all')` : sql``}
      order by starts_at limit ${filter.limit}`);
    return rows.rows.map((e) => ({
      id: e.id as string,
      slug: e.slug as string,
      title: e.title as string,
      description: (e.description as string | null) ?? null,
      audience: e.audience as string,
      startsAt: iso(e.starts_at)!,
      endsAt: iso(e.ends_at),
      location: (e.location as string | null) ?? null,
      onlineUrl: (e.online_url as string | null) ?? null,
      organizer: (e.organizer as string | null) ?? null,
      coverUrl: this.storage.publicUrl(e.cover_key as string | null),
    }));
  }

  async createEvent(actorId: string, input: z.output<typeof educationEventSchema>) {
    const [row] = await this.db
      .insert(events)
      .values({ slug: slugFor(input.title), title: input.title, description: input.description || null, audience: input.audience, startsAt: new Date(input.startsAt), endsAt: input.endsAt ? new Date(input.endsAt) : null, location: input.location || null, onlineUrl: input.onlineUrl ?? null, organizer: input.organizer || null, createdBy: actorId })
      .returning({ id: events.id, slug: events.slug });
    await this.audit.record({ action: 'student.event.create', entityType: 'event', entityId: row!.id, after: input });
    return row!;
  }

  async deleteEvent(actorId: string, id: string): Promise<void> {
    const deleted = await this.db.delete(events).where(eq(events.id, id)).returning({ id: events.id });
    if (!deleted.length) throw AppException.notFound('Event');
    await this.audit.record({ action: 'student.event.delete', entityType: 'event', entityId: id });
  }

  // ------------------------------------------------------------------ competitions

  async competitions(filter: { status?: string; limit: number; includeDrafts?: boolean }) {
    const rows = await this.db.execute<Row>(sql`
      select c.*, (select count(*)::int from competition_entries e where e.competition_id = c.id and e.status <> 'disqualified') as entry_count
      from competitions c where ${filter.includeDrafts ? sql`true` : sql`c.status <> 'draft'`} ${filter.status ? sql`and c.status = ${filter.status}` : sql``}
      order by case c.status when 'open' then 0 when 'judging' then 1 when 'closed' then 2 else 3 end, c.ends_at limit ${filter.limit}`);
    return rows.rows.map((c) => this.competitionView(c));
  }

  private competitionView(c: Row) {
    return {
      id: c.id as string,
      slug: c.slug as string,
      title: c.title as string,
      kind: c.kind as string,
      rules: c.rules as string,
      prizes: (c.prizes as string | null) ?? null,
      audience: c.audience as string,
      startsAt: iso(c.starts_at)!,
      endsAt: iso(c.ends_at)!,
      status: c.status as string,
      entryCount: Number(c.entry_count ?? 0),
    };
  }

  async competition(slug: string, viewerId?: string) {
    const rows = await this.db.execute<Row>(sql`
      select c.*, (select count(*)::int from competition_entries e where e.competition_id = c.id and e.status <> 'disqualified') as entry_count
      from competitions c where c.slug = ${slug} and c.status <> 'draft'`);
    const c = rows.rows[0];
    if (!c) throw AppException.notFound('Competition');
    const [winners, mine] = await Promise.all([
      this.db.execute<Row>(sql`
        select e.status, e.score, p.id as post_id, p.title, u.username, u.display_name from competition_entries e
        join posts p on p.id = e.post_id join users u on u.id = e.user_id
        where e.competition_id = ${c.id} and e.status in ('winner', 'shortlisted') and p.deleted_at is null
        order by case e.status when 'winner' then 0 else 1 end, e.score desc nulls last limit 20`),
      viewerId ? this.db.select({ status: competitionEntries.status, postId: competitionEntries.postId }).from(competitionEntries).where(and(eq(competitionEntries.competitionId, c.id as string), eq(competitionEntries.userId, viewerId))) : Promise.resolve([]),
    ]);
    return {
      ...this.competitionView(c),
      // Results are published once judging is over.
      results: c.status === 'closed' ? winners.rows.map((w) => ({ status: w.status as string, score: w.score === null ? null : Number(w.score), postId: w.post_id as string, title: (w.title as string | null) ?? null, author: { username: w.username as string, name: w.display_name as string } })) : [],
      myEntry: mine[0] ?? null,
    };
  }

  /** Enter an open competition with one of your own published posts (one entry each). */
  async enter(userId: string, slug: string, postId: string) {
    const [c] = await this.db.select().from(competitions).where(eq(competitions.slug, slug));
    if (!c || c.status === 'draft') throw AppException.notFound('Competition');
    const now = new Date();
    if (c.status !== 'open' || now < c.startsAt || now > c.endsAt) throw new AppException('CONFLICT', 'api.student.competitionClosed');
    const [post] = await this.db.select({ authorId: posts.authorId, status: posts.status, deletedAt: posts.deletedAt }).from(posts).where(eq(posts.id, postId));
    if (!post || post.authorId !== userId || post.deletedAt || post.status !== 'published') throw AppException.validation([{ field: 'postId', code: 'invalid', message: 'validation.ownPublishedPost' }]);
    const inserted = await this.db.insert(competitionEntries).values({ competitionId: c.id, userId, postId }).onConflictDoNothing().returning({ id: competitionEntries.id });
    if (!inserted.length) throw new AppException('CONFLICT', 'api.student.alreadyEntered');
    return { id: inserted[0]!.id };
  }

  async createCompetition(actorId: string, input: z.output<typeof competitionSchema>) {
    const [row] = await this.db
      .insert(competitions)
      .values({ slug: slugFor(input.title), title: input.title, kind: input.kind, rules: input.rules, prizes: input.prizes || null, audience: input.audience, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), status: input.status, createdBy: actorId })
      .returning({ id: competitions.id, slug: competitions.slug });
    await this.audit.record({ action: 'student.competition.create', entityType: 'competition', entityId: row!.id, after: input });
    return row!;
  }

  async setCompetitionStatus(actorId: string, slug: string, status: 'draft' | 'open' | 'judging' | 'closed') {
    const [row] = await this.db.update(competitions).set({ status, updatedAt: new Date() }).where(eq(competitions.slug, slug)).returning({ id: competitions.id, title: competitions.title });
    if (!row) throw AppException.notFound('Competition');
    await this.audit.record({ action: 'student.competition.status', entityType: 'competition', entityId: row.id, after: { status } });
    if (status === 'closed') {
      const winners = await this.db.select({ userId: competitionEntries.userId }).from(competitionEntries).where(and(eq(competitionEntries.competitionId, row.id), eq(competitionEntries.status, 'winner')));
      for (const w of winners) {
        await this.notifications.notify(w.userId, { type: 'announcement', titleKey: 'api.student.winnerTitle', bodyKey: 'api.student.winnerBody', params: { title: row.title }, link: `/student-zone/competitions/${slug}` }).catch(() => undefined);
      }
    }
    return { status };
  }

  async entries(slug: string) {
    const rows = await this.db.execute<Row>(sql`
      select e.id, e.status, e.score, e.judge_note, e.created_at, p.id as post_id, p.title, p.body, u.username, u.display_name
      from competition_entries e join competitions c on c.id = e.competition_id join posts p on p.id = e.post_id join users u on u.id = e.user_id
      where c.slug = ${slug} order by e.created_at`);
    return rows.rows.map((e) => ({ id: e.id as string, status: e.status as string, score: e.score === null ? null : Number(e.score), note: (e.judge_note as string | null) ?? null, createdAt: iso(e.created_at)!, post: { id: e.post_id as string, title: (e.title as string | null) ?? null, excerpt: (e.body as string).slice(0, 280) }, author: { username: e.username as string, name: e.display_name as string } }));
  }

  async judge(actorId: string, entryId: string, input: z.output<typeof entryJudgementSchema>) {
    const [row] = await this.db
      .update(competitionEntries)
      .set({ status: input.status, score: input.score ?? null, judgeNote: input.note || null })
      .where(eq(competitionEntries.id, entryId))
      .returning({ id: competitionEntries.id });
    if (!row) throw AppException.notFound('Entry');
    await this.audit.record({ action: 'student.competition.judge', entityType: 'competition_entry', entityId: entryId, after: input });
    return { id: entryId, ...input };
  }

  // ------------------------------------------------------------------ scholarships

  async scholarships(filter: { level?: string; limit: number }) {
    const rows = await this.db.execute<Row>(sql`
      select * from scholarships where status = 'published' and (deadline is null or deadline >= (now() at time zone 'Asia/Dhaka')::date)
        ${filter.level ? sql`and (academic_level = ${filter.level} or academic_level is null)` : sql``}
      order by deadline nulls last, created_at desc limit ${filter.limit}`);
    return rows.rows.map((s) => ({
      id: s.id as string,
      slug: s.slug as string,
      title: s.title as string,
      provider: s.provider as string,
      description: s.description as string,
      eligibility: (s.eligibility as string | null) ?? null,
      amountText: (s.amount_text as string | null) ?? null,
      academicLevel: (s.academic_level as string | null) ?? null,
      deadline: s.deadline ? String(s.deadline).slice(0, 10) : null,
      applyUrl: (s.apply_url as string | null) ?? null,
    }));
  }

  async createScholarship(actorId: string, input: z.output<typeof scholarshipSchema>) {
    const [row] = await this.db
      .insert(scholarships)
      .values({ slug: slugFor(input.title), title: input.title, provider: input.provider, description: input.description, eligibility: input.eligibility || null, amountText: input.amountText || null, academicLevel: input.academicLevel ?? null, deadline: input.deadline ?? null, applyUrl: input.applyUrl ?? null, createdBy: actorId })
      .returning({ id: scholarships.id, slug: scholarships.slug });
    await this.audit.record({ action: 'student.scholarship.create', entityType: 'scholarship', entityId: row!.id, after: input });
    return row!;
  }

  async deleteScholarship(actorId: string, id: string): Promise<void> {
    const deleted = await this.db.delete(scholarships).where(eq(scholarships.id, id)).returning({ id: scholarships.id });
    if (!deleted.length) throw AppException.notFound('Scholarship');
    await this.audit.record({ action: 'student.scholarship.delete', entityType: 'scholarship', entityId: id });
  }
}
