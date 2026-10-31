import { Inject, Injectable } from '@nestjs/common';
import {
  bookClubBooks,
  bookClubEvents,
  bookClubMembers,
  bookClubPollOptions,
  bookClubPolls,
  bookClubPollVotes,
  bookClubPosts,
  bookClubs,
  bookClubSchedule,
  type Database,
  type DbOrTx,
  users,
} from '@boikonika/database';
import type { clubBookSchema, clubEventSchema, clubListQuerySchema, clubPostSchema, clubSchema, clubUpdateSchema, MemberAction, pollSchema, scheduleItemSchema } from '@boikonika/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { assertNotRestricted } from '../../common/util/restrictions';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { processUpload } from '../../infra/storage/uploads';
import { contentRisk, HOLD_THRESHOLD } from '../community/content-risk';
import { GamificationService } from '../gamification/gamification.service';
import { uniqueSlug } from '../marketplace/sellers.service';
import { NotificationsService } from '../notifications/notifications.service';

type Row = Record<string, unknown>;
type Club = typeof bookClubs.$inferSelect;
type Member = { role: 'owner' | 'moderator' | 'member'; status: 'active' | 'pending' | 'invited' | 'banned' | 'left' } | null;
const CLUBS_PER_DAY = 3;
const POSTS_PER_10_MIN = 20;
const ANNOUNCE_TO = 2000;

const isActive = (m: Member) => m?.status === 'active';
const isModerator = (m: Member) => isActive(m) && (m!.role === 'owner' || m!.role === 'moderator');

/**
 * Book clubs and Student Zone study groups: membership by join policy, moderators, invitations,
 * discussions and announcements, events, the book of the month with a reading schedule, and polls.
 */
@Injectable()
export class ClubsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly gamification: GamificationService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------------ helpers

  private async club(tx: DbOrTx, slug: string): Promise<Club> {
    const [club] = await tx.select().from(bookClubs).where(and(eq(bookClubs.slug, slug), eq(bookClubs.status, 'published')));
    if (!club) throw AppException.notFound('Club');
    return club;
  }

  private async member(tx: DbOrTx, clubId: string, userId?: string): Promise<Member> {
    if (!userId) return null;
    const [row] = await tx.select({ role: bookClubMembers.role, status: bookClubMembers.status }).from(bookClubMembers).where(and(eq(bookClubMembers.clubId, clubId), eq(bookClubMembers.userId, userId)));
    return row ?? null;
  }

  /** Private clubs show their content to members only; every other type is open to read. */
  private canRead(club: Club, m: Member) {
    return club.type !== 'private' || isActive(m);
  }

  private async moderated(tx: DbOrTx, slug: string, userId: string) {
    const club = await this.club(tx, slug);
    const m = await this.member(tx, club.id, userId);
    if (!isModerator(m)) throw AppException.forbidden('api.clubs.moderatorsOnly');
    return { club, member: m! };
  }

  private async notifyMembers(clubId: string, exceptUserId: string, input: { titleKey: string; bodyKey: string; params: Record<string, string | number | Date>; link: string }) {
    const rows = await this.db
      .select({ userId: bookClubMembers.userId })
      .from(bookClubMembers)
      .where(and(eq(bookClubMembers.clubId, clubId), eq(bookClubMembers.status, 'active')))
      .limit(ANNOUNCE_TO);
    for (const r of rows) {
      if (r.userId === exceptUserId) continue;
      await this.notifications.notify(r.userId, { type: 'book_club', ...input, groupKey: `club:${clubId}` }).catch(() => undefined);
    }
  }

  private async notifyModerators(clubId: string, input: { titleKey: string; bodyKey: string; params: Record<string, string | number>; link: string }) {
    const mods = await this.db
      .select({ userId: bookClubMembers.userId })
      .from(bookClubMembers)
      .where(and(eq(bookClubMembers.clubId, clubId), eq(bookClubMembers.status, 'active'), inArray(bookClubMembers.role, ['owner', 'moderator'])));
    for (const r of mods) await this.notifications.notify(r.userId, { type: 'book_club', ...input }).catch(() => undefined);
  }

  // ------------------------------------------------------------------ clubs

  async list(q: z.output<typeof clubListQuerySchema>, viewerId?: string) {
    const where: ReturnType<typeof sql>[] = [sql`c.status = 'published'`];
    if (q.type) where.push(sql`c.type = ${q.type}`);
    if (q.purpose) where.push(sql`c.purpose = ${q.purpose}`);
    if (q.subject) where.push(sql`c.subject = ${q.subject}`);
    if (q.q) where.push(sql`(c.name % ${q.q} or c.name ilike ${`%${q.q.replace(/[%_\\]/g, '')}%`} or c.institution_name ilike ${`%${q.q.replace(/[%_\\]/g, '')}%`})`);
    if (q.mine && viewerId) where.push(sql`exists (select 1 from book_club_members m where m.club_id = c.id and m.user_id = ${viewerId} and m.status in ('active', 'pending', 'invited'))`);
    const condition = sql.join(where, sql` and `);
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select c.*, m.role as my_role, m.status as my_status,
          (select json_build_object('title', b.title, 'slug', b.slug, 'coverKey', b.cover_key) from book_club_books cb join books b on b.id = cb.book_id
            where cb.club_id = c.id and cb.status = 'current' order by cb.month desc limit 1) as current_book
        from book_clubs c left join book_club_members m on m.club_id = c.id and m.user_id = ${viewerId ?? null}
        where ${condition}
        order by ${q.q ? sql`similarity(c.name, ${q.q}) desc,` : sql``} c.member_count desc, c.created_at desc
        limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from book_clubs c where ${condition}`),
    ]);
    return { items: rows.rows.map((r) => this.card(r)), meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.n ?? 0 } };
  }

  private card(r: Row) {
    const book = r.current_book as { title: string; slug: string; coverKey: string | null } | null;
    return {
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      type: r.type as string,
      purpose: r.purpose as string,
      subject: (r.subject as string | null) ?? null,
      institutionName: (r.institution_name as string | null) ?? null,
      joinPolicy: r.join_policy as string,
      coverUrl: this.storage.publicUrl(r.cover_key as string | null),
      memberCount: Number(r.member_count ?? 0),
      currentBook: book ? { title: book.title, slug: book.slug, coverUrl: this.storage.publicUrl(book.coverKey) } : null,
      membership: r.my_status ? { role: r.my_role as string, status: r.my_status as string } : null,
    };
  }

  async create(userId: string, input: z.output<typeof clubSchema>) {
    const slug = await this.db.transaction(async (tx) => {
      const [{ recent } = { recent: 0 }] = await tx
        .execute<{ recent: number }>(sql`select count(*)::int as recent from book_clubs where owner_id = ${userId} and created_at > now() - interval '1 day'`)
        .then((r) => r.rows);
      if (recent >= CLUBS_PER_DAY) throw new AppException('RATE_LIMITED', 'api.clubs.tooMany');
      const slug = await uniqueSlug(tx, 'book_clubs', input.name);
      const [club] = await tx
        .insert(bookClubs)
        .values({
          slug,
          name: input.name,
          description: input.description || null,
          type: input.type,
          purpose: input.purpose,
          subject: input.purpose === 'study' ? (input.subject ?? null) : null,
          institutionName: input.institutionName || null,
          joinPolicy: input.joinPolicy,
          rules: input.rules || null,
          ownerId: userId,
          memberCount: 1,
        })
        .returning();
      await tx.insert(bookClubMembers).values({ clubId: club!.id, userId, role: 'owner', status: 'active' });
      return slug;
    });
    await this.gamification.evaluateBadges(userId).catch(() => undefined);
    return this.detail(slug, userId);
  }

  async update(userId: string, slug: string, input: z.output<typeof clubUpdateSchema>) {
    const { club, member } = await this.moderated(this.db, slug, userId);
    // Who may join and whether the club is private are the owner's call.
    if ((input.type || input.joinPolicy) && member.role !== 'owner') throw AppException.forbidden('api.clubs.ownerOnly');
    const next = { type: input.type ?? club.type, joinPolicy: input.joinPolicy ?? club.joinPolicy };
    if (next.type === 'private' && next.joinPolicy === 'open') throw AppException.validation([{ field: 'joinPolicy', code: 'custom', message: 'validation.privateClubPolicy' }]);
    const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    await this.db.update(bookClubs).set({ ...changes, updatedAt: new Date() }).where(eq(bookClubs.id, club.id));
    return this.detail(slug, userId);
  }

  async setCover(userId: string, slug: string, file: Buffer) {
    const { club } = await this.moderated(this.db, slug, userId);
    const processed = await processUpload(file, { allowed: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024, image: { maxWidth: 1600, maxHeight: 600, format: 'webp', crop: true } });
    const key = `clubs/${club.id}/${randomUUID()}.${processed.extension}`;
    await this.storage.put('public', key, processed.body, processed.contentType);
    await this.db.update(bookClubs).set({ coverKey: key, updatedAt: new Date() }).where(eq(bookClubs.id, club.id));
    if (club.coverKey) await this.storage.delete('public', club.coverKey).catch(() => undefined);
    return { url: this.storage.publicUrl(key) };
  }

  async detail(slug: string, viewerId?: string) {
    const club = await this.club(this.db, slug);
    const m = await this.member(this.db, club.id, viewerId);
    const readable = this.canRead(club, m);
    const [owner, books, events, polls, pending] = await Promise.all([
      this.db.execute<Row>(sql`select u.username, u.display_name, up.avatar_key from users u left join user_profiles up on up.user_id = u.id where u.id = ${club.ownerId}`).then((r) => r.rows[0]),
      readable
        ? this.db.execute<Row>(sql`
            select cb.id, cb.month::text as month, cb.status, b.id as book_id, b.slug, b.title, b.cover_key,
              coalesce((select array_agg(a.name order by ba.position) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id), '{}') as authors,
              coalesce((select json_agg(json_build_object('id', s.id, 'title', s.title, 'fromPage', s.from_page, 'toPage', s.to_page, 'dueOn', s.due_on) order by s.due_on, s.position)
                from book_club_schedule s where s.club_book_id = cb.id), '[]') as schedule
            from book_club_books cb join books b on b.id = cb.book_id where cb.club_id = ${club.id}
            order by case cb.status when 'current' then 0 when 'upcoming' then 1 else 2 end, cb.month desc limit 6`)
        : Promise.resolve({ rows: [] as Row[] }),
      readable
        ? this.db.select().from(bookClubEvents).where(and(eq(bookClubEvents.clubId, club.id), sql`coalesce(${bookClubEvents.endsAt}, ${bookClubEvents.startsAt}) > now() - interval '1 day'`)).orderBy(bookClubEvents.startsAt).limit(10)
        : Promise.resolve([]),
      readable ? this.pollViews(club.id, viewerId) : Promise.resolve([]),
      isModerator(m) ? this.db.execute<{ n: number }>(sql`select count(*)::int as n from book_club_members where club_id = ${club.id} and status = 'pending'`).then((r) => r.rows[0]?.n ?? 0) : Promise.resolve(0),
    ]);
    return {
      ...this.card({ ...club, cover_key: club.coverKey, member_count: club.memberCount, institution_name: club.institutionName, join_policy: club.joinPolicy, my_role: m?.role, my_status: m?.status, current_book: null } as Row),
      rules: club.rules,
      createdAt: club.createdAt.toISOString(),
      owner: owner ? { username: owner.username as string, name: owner.display_name as string, avatarUrl: this.storage.publicUrl(owner.avatar_key as string | null) } : null,
      readable,
      canModerate: isModerator(m),
      isOwner: m?.role === 'owner' && isActive(m),
      pendingCount: Number(pending),
      books: books.rows.map((b) => ({
        id: b.id as string,
        month: (b.month as string).slice(0, 7),
        status: b.status as string,
        book: { id: b.book_id as string, slug: b.slug as string, title: b.title as string, coverUrl: this.storage.publicUrl(b.cover_key as string | null), authors: (b.authors as string[]) ?? [] },
        schedule: (b.schedule as Array<{ id: string; title: string; fromPage: number | null; toPage: number | null; dueOn: string }>) ?? [],
      })),
      events: events.map((e) => ({ id: e.id, title: e.title, description: e.description, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null, location: e.location, onlineUrl: isActive(m) ? e.onlineUrl : null })),
      polls,
    };
  }

  // ------------------------------------------------------------------ membership

  async join(userId: string, slug: string) {
    const result = await this.db.transaction(async (tx) => {
      const club = await this.club(tx, slug);
      const m = await this.member(tx, club.id, userId);
      if (m?.status === 'banned') throw AppException.forbidden('api.clubs.banned');
      if (m?.status === 'active') throw new AppException('CONFLICT', 'api.clubs.alreadyMember');
      if (m?.status === 'pending') throw new AppException('CONFLICT', 'api.clubs.requestPending');
      if (club.joinPolicy === 'invite' && m?.status !== 'invited') throw AppException.forbidden('api.clubs.inviteOnly');
      const status = club.joinPolicy === 'request' && m?.status !== 'invited' ? ('pending' as const) : ('active' as const);
      await tx
        .insert(bookClubMembers)
        .values({ clubId: club.id, userId, role: 'member', status })
        .onConflictDoUpdate({ target: [bookClubMembers.clubId, bookClubMembers.userId], set: { status, role: 'member', joinedAt: new Date() } });
      if (status === 'active') await tx.update(bookClubs).set({ memberCount: sql`${bookClubs.memberCount} + 1` }).where(eq(bookClubs.id, club.id));
      return { club, status };
    });
    if (result.status === 'active') await this.gamification.evaluateBadges(userId).catch(() => undefined);
    else {
      const [u] = await this.db.select({ name: users.displayName }).from(users).where(eq(users.id, userId));
      await this.notifyModerators(result.club.id, { titleKey: 'api.clubs.requestTitle', bodyKey: 'api.clubs.requestBody', params: { name: u?.name ?? '', club: result.club.name }, link: `/clubs/${slug}?tab=members` });
    }
    return { status: result.status };
  }

  async leave(userId: string, slug: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const club = await this.club(tx, slug);
      const m = await this.member(tx, club.id, userId);
      if (!m || !['active', 'pending', 'invited'].includes(m.status)) throw AppException.notFound('Membership');
      if (m.role === 'owner') throw AppException.badRequest('api.clubs.ownerCannotLeave');
      await tx.update(bookClubMembers).set({ status: 'left' }).where(and(eq(bookClubMembers.clubId, club.id), eq(bookClubMembers.userId, userId)));
      if (m.status === 'active') await tx.update(bookClubs).set({ memberCount: sql`greatest(0, ${bookClubs.memberCount} - 1)` }).where(eq(bookClubs.id, club.id));
    });
  }

  async members(slug: string, viewerId: string | undefined, status: 'active' | 'pending' | 'invited') {
    const club = await this.club(this.db, slug);
    const m = await this.member(this.db, club.id, viewerId);
    if (status !== 'active' ? !isModerator(m) : !this.canRead(club, m)) throw AppException.forbidden('api.clubs.membersOnly');
    const rows = await this.db.execute<Row>(sql`
      select u.id, u.username, u.display_name, up.avatar_key, m.role, m.status, m.joined_at
      from book_club_members m join users u on u.id = m.user_id left join user_profiles up on up.user_id = u.id
      where m.club_id = ${club.id} and m.status = ${status} and u.status = 'active'
      order by case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end, m.joined_at limit 500`);
    return rows.rows.map((r) => ({ id: r.id as string, username: r.username as string, name: r.display_name as string, avatarUrl: this.storage.publicUrl(r.avatar_key as string | null), role: r.role as string, status: r.status as string, joinedAt: new Date(r.joined_at as string).toISOString() }));
  }

  /** Moderators approve, reject, remove or ban members; only the owner promotes or demotes. */
  async memberAction(actorId: string, slug: string, targetId: string, action: MemberAction) {
    const outcome = await this.db.transaction(async (tx) => {
      const { club, member: actor } = await this.moderated(tx, slug, actorId);
      const target = await this.member(tx, club.id, targetId);
      if (!target || targetId === actorId) throw AppException.notFound('Membership');
      if (target.role === 'owner') throw AppException.forbidden('api.clubs.ownerProtected');
      if ((action === 'promote' || action === 'demote' || target.role === 'moderator') && actor.role !== 'owner') throw AppException.forbidden('api.clubs.ownerOnly');
      const where = and(eq(bookClubMembers.clubId, club.id), eq(bookClubMembers.userId, targetId));
      const countDelta = (from: Member, toActive: boolean) => (from?.status === 'active' ? (toActive ? 0 : -1) : toActive ? 1 : 0);
      let delta = 0;
      switch (action) {
        case 'approve':
          if (target.status !== 'pending') throw new AppException('CONFLICT', 'api.clubs.notPending');
          await tx.update(bookClubMembers).set({ status: 'active', joinedAt: new Date() }).where(where);
          delta = 1;
          break;
        case 'reject':
          if (target.status !== 'pending') throw new AppException('CONFLICT', 'api.clubs.notPending');
          await tx.delete(bookClubMembers).where(where);
          break;
        case 'remove':
          await tx.update(bookClubMembers).set({ status: 'left', role: 'member' }).where(where);
          delta = countDelta(target, false);
          break;
        case 'ban':
          await tx.update(bookClubMembers).set({ status: 'banned', role: 'member' }).where(where);
          delta = countDelta(target, false);
          break;
        case 'promote':
          if (target.status !== 'active') throw new AppException('CONFLICT', 'api.clubs.notMember');
          await tx.update(bookClubMembers).set({ role: 'moderator' }).where(where);
          break;
        case 'demote':
          await tx.update(bookClubMembers).set({ role: 'member' }).where(where);
          break;
      }
      if (delta) await tx.update(bookClubs).set({ memberCount: sql`greatest(0, ${bookClubs.memberCount} + ${delta})` }).where(eq(bookClubs.id, club.id));
      return club;
    });
    if (action === 'approve') {
      await this.notifications.notify(targetId, { type: 'book_club', titleKey: 'api.clubs.approvedTitle', bodyKey: 'api.clubs.approvedBody', params: { club: outcome.name }, link: `/clubs/${slug}` }).catch(() => undefined);
      await this.gamification.evaluateBadges(targetId).catch(() => undefined);
    }
    return { action };
  }

  async invite(actorId: string, slug: string, username: string) {
    const { club } = await this.moderated(this.db, slug, actorId);
    const [target] = await this.db.select({ id: users.id, status: users.status }).from(users).where(eq(users.username, username));
    if (!target || target.status !== 'active') throw AppException.validation([{ field: 'username', code: 'not_found', message: 'validation.userNotFound' }]);
    const existing = await this.member(this.db, club.id, target.id);
    if (existing?.status === 'active') throw new AppException('CONFLICT', 'api.clubs.alreadyMember');
    if (existing?.status === 'banned') throw AppException.forbidden('api.clubs.banned');
    await this.db
      .insert(bookClubMembers)
      .values({ clubId: club.id, userId: target.id, role: 'member', status: 'invited', invitedBy: actorId })
      .onConflictDoUpdate({ target: [bookClubMembers.clubId, bookClubMembers.userId], set: { status: 'invited', invitedBy: actorId } });
    const [actor] = await this.db.select({ name: users.displayName }).from(users).where(eq(users.id, actorId));
    await this.notifications.notify(target.id, { type: 'book_club', titleKey: 'api.clubs.inviteTitle', bodyKey: 'api.clubs.inviteBody', params: { name: actor?.name ?? '', club: club.name }, link: `/clubs/${slug}`, actorId }).catch(() => undefined);
    return { invited: username };
  }

  // ------------------------------------------------------------------ discussions

  async posts(slug: string, viewerId: string | undefined, page: number, pageSize: number) {
    const club = await this.club(this.db, slug);
    const m = await this.member(this.db, club.id, viewerId);
    if (!this.canRead(club, m)) throw AppException.forbidden('api.clubs.membersOnly');
    const visible = sql`(p.status = 'published' ${viewerId ? sql`or p.author_id = ${viewerId}` : sql``}) and p.status <> 'removed'`;
    const [top, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select p.*, u.username, u.display_name, up.avatar_key from book_club_posts p join users u on u.id = p.author_id left join user_profiles up on up.user_id = u.id
        where p.club_id = ${club.id} and p.parent_id is null and ${visible}
        order by p.is_pinned desc, p.created_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from book_club_posts p where p.club_id = ${club.id} and p.parent_id is null and ${visible}`),
    ]);
    const replies = top.rows.length
      ? await this.db.execute<Row>(sql`
          select p.*, u.username, u.display_name, up.avatar_key from book_club_posts p join users u on u.id = p.author_id left join user_profiles up on up.user_id = u.id
          where p.parent_id in (${sql.join(top.rows.map((r) => sql`${r.id}::uuid`), sql`, `)}) and ${visible} order by p.created_at limit 1000`)
      : { rows: [] as Row[] };
    const view = (p: Row) => ({
      id: p.id as string,
      parentId: (p.parent_id as string | null) ?? null,
      title: (p.title as string | null) ?? null,
      body: p.body as string,
      kind: p.kind as string,
      pinned: p.is_pinned === true,
      pending: p.status !== 'published',
      replyCount: Number(p.reply_count ?? 0),
      mine: !!viewerId && p.author_id === viewerId,
      canDelete: !!viewerId && (p.author_id === viewerId || isModerator(m)),
      author: { username: p.username as string, name: p.display_name as string, avatarUrl: this.storage.publicUrl(p.avatar_key as string | null) },
      createdAt: new Date(p.created_at as string).toISOString(),
    });
    return {
      items: top.rows.map((p) => ({ ...view(p), replies: replies.rows.filter((r) => r.parent_id === p.id).map(view) })),
      meta: { page, pageSize, total: total.rows[0]?.n ?? 0 },
    };
  }

  async createPost(userId: string, slug: string, input: z.output<typeof clubPostSchema>) {
    const result = await this.db.transaction(async (tx) => {
      await assertNotRestricted(tx, userId, 'post');
      const club = await this.club(tx, slug);
      const m = await this.member(tx, club.id, userId);
      if (!isActive(m)) throw AppException.forbidden('api.clubs.membersOnly');
      if (input.kind === 'announcement' && (!isModerator(m) || input.parentId)) throw AppException.forbidden('api.clubs.moderatorsOnly');
      const [{ recent } = { recent: 0 }] = await tx
        .execute<{ recent: number }>(sql`select count(*)::int as recent from book_club_posts where author_id = ${userId} and created_at > now() - interval '10 minutes'`)
        .then((r) => r.rows);
      if (recent >= POSTS_PER_10_MIN) throw new AppException('RATE_LIMITED', 'api.community.tooManyComments');
      let parent: { id: string; authorId: string } | null = null;
      if (input.parentId) {
        const [p] = await tx.select().from(bookClubPosts).where(and(eq(bookClubPosts.id, input.parentId), eq(bookClubPosts.clubId, club.id)));
        if (!p || p.status === 'removed') throw AppException.notFound('Post');
        parent = { id: p.parentId ?? p.id, authorId: p.authorId };
      }
      const [author] = await tx.select({ createdAt: users.createdAt, name: users.displayName }).from(users).where(eq(users.id, userId));
      const risk = contentRisk({ text: `${input.title ?? ''}\n${input.body}`, accountAgeHours: (Date.now() - (author?.createdAt.getTime() ?? Date.now())) / 3_600_000, recentCount: recent, studentZone: club.purpose === 'study' });
      // Moderators' own posts are trusted in their club.
      const status = risk >= HOLD_THRESHOLD && !isModerator(m) ? ('pending_review' as const) : ('published' as const);
      const [post] = await tx
        .insert(bookClubPosts)
        .values({ clubId: club.id, authorId: userId, parentId: parent?.id ?? null, title: parent ? null : input.title || null, body: input.body, kind: parent ? 'discussion' : input.kind, status })
        .returning();
      if (parent && status === 'published') await tx.update(bookClubPosts).set({ replyCount: sql`${bookClubPosts.replyCount} + 1` }).where(eq(bookClubPosts.id, parent.id));
      return { club, post: post!, parent, status, actor: author?.name ?? '' };
    });
    if (result.status === 'published') {
      if (result.post.kind === 'announcement') {
        await this.notifyMembers(result.club.id, userId, { titleKey: 'api.clubs.announcementTitle', bodyKey: 'api.clubs.announcementBody', params: { club: result.club.name, title: result.post.title ?? '' }, link: `/clubs/${slug}` });
      } else if (result.parent && result.parent.authorId !== userId) {
        await this.notifications
          .notify(result.parent.authorId, { type: 'book_club', titleKey: 'api.clubs.replyTitle', bodyKey: 'api.clubs.replyBody', params: { name: result.actor, club: result.club.name }, link: `/clubs/${slug}#post-${result.parent.id}`, actorId: userId })
          .catch(() => undefined);
      }
    }
    return { id: result.post.id, status: result.status };
  }

  async deletePost(userId: string, slug: string, postId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const club = await this.club(tx, slug);
      const m = await this.member(tx, club.id, userId);
      const [post] = await tx.select().from(bookClubPosts).where(and(eq(bookClubPosts.id, postId), eq(bookClubPosts.clubId, club.id)));
      if (!post || post.status === 'removed' || (post.authorId !== userId && !isModerator(m))) throw AppException.notFound('Post');
      await tx.update(bookClubPosts).set({ status: 'removed', updatedAt: new Date() }).where(eq(bookClubPosts.id, postId));
      if (post.parentId && post.status === 'published') await tx.update(bookClubPosts).set({ replyCount: sql`greatest(0, ${bookClubPosts.replyCount} - 1)` }).where(eq(bookClubPosts.id, post.parentId));
    });
  }

  async pin(userId: string, slug: string, postId: string, pinned: boolean) {
    const { club } = await this.moderated(this.db, slug, userId);
    const updated = await this.db
      .update(bookClubPosts)
      .set({ isPinned: pinned })
      .where(and(eq(bookClubPosts.id, postId), eq(bookClubPosts.clubId, club.id), sql`${bookClubPosts.parentId} is null`))
      .returning({ id: bookClubPosts.id });
    if (!updated.length) throw AppException.notFound('Post');
    return { pinned };
  }

  // ------------------------------------------------------------------ events, books, schedule

  async createEvent(userId: string, slug: string, input: z.output<typeof clubEventSchema>) {
    const { club } = await this.moderated(this.db, slug, userId);
    const [event] = await this.db
      .insert(bookClubEvents)
      .values({ clubId: club.id, title: input.title, description: input.description || null, startsAt: new Date(input.startsAt), endsAt: input.endsAt ? new Date(input.endsAt) : null, location: input.location || null, onlineUrl: input.onlineUrl ?? null, createdBy: userId })
      .returning();
    await this.notifyMembers(club.id, userId, { titleKey: 'api.clubs.eventTitle', bodyKey: 'api.clubs.eventBody', params: { club: club.name, title: input.title, when: new Date(input.startsAt) }, link: `/clubs/${slug}` });
    return { id: event!.id };
  }

  async deleteEvent(userId: string, slug: string, eventId: string): Promise<void> {
    const { club } = await this.moderated(this.db, slug, userId);
    const deleted = await this.db.delete(bookClubEvents).where(and(eq(bookClubEvents.id, eventId), eq(bookClubEvents.clubId, club.id))).returning();
    if (!deleted.length) throw AppException.notFound('Event');
  }

  /** Sets a month's book; making one "current" finishes the earlier current book. */
  async setBook(userId: string, slug: string, input: z.output<typeof clubBookSchema>) {
    const { club } = await this.moderated(this.db, slug, userId);
    const month = `${input.month}-01`;
    return this.db.transaction(async (tx) => {
      const [book] = await tx.execute<{ id: string }>(sql`select id from books where id = ${input.bookId} and status = 'published' and deleted_at is null`).then((r) => r.rows);
      if (!book) throw AppException.validation([{ field: 'bookId', code: 'not_found', message: 'validation.bookRequired' }]);
      if (input.status === 'current') await tx.update(bookClubBooks).set({ status: 'finished' }).where(and(eq(bookClubBooks.clubId, club.id), eq(bookClubBooks.status, 'current'), sql`${bookClubBooks.month} <> ${month}`));
      const [row] = await tx
        .insert(bookClubBooks)
        .values({ clubId: club.id, bookId: input.bookId, month, status: input.status })
        .onConflictDoUpdate({ target: [bookClubBooks.clubId, bookClubBooks.month], set: { bookId: input.bookId, status: input.status } })
        .returning({ id: bookClubBooks.id });
      return { id: row!.id };
    });
  }

  async removeBook(userId: string, slug: string, clubBookId: string): Promise<void> {
    const { club } = await this.moderated(this.db, slug, userId);
    const deleted = await this.db.delete(bookClubBooks).where(and(eq(bookClubBooks.id, clubBookId), eq(bookClubBooks.clubId, club.id))).returning();
    if (!deleted.length) throw AppException.notFound('Book');
  }

  async addScheduleItem(userId: string, slug: string, clubBookId: string, input: z.output<typeof scheduleItemSchema>) {
    const { club } = await this.moderated(this.db, slug, userId);
    const [cb] = await this.db.select({ id: bookClubBooks.id }).from(bookClubBooks).where(and(eq(bookClubBooks.id, clubBookId), eq(bookClubBooks.clubId, club.id)));
    if (!cb) throw AppException.notFound('Book');
    const [{ n } = { n: 0 }] = await this.db.execute<{ n: number }>(sql`select count(*)::int as n from book_club_schedule where club_book_id = ${clubBookId}`).then((r) => r.rows);
    const [row] = await this.db
      .insert(bookClubSchedule)
      .values({ clubBookId, title: input.title, fromPage: input.fromPage ?? null, toPage: input.toPage ?? null, dueOn: input.dueOn, position: Number(n) })
      .returning({ id: bookClubSchedule.id });
    return { id: row!.id };
  }

  async removeScheduleItem(userId: string, slug: string, itemId: string): Promise<void> {
    const { club } = await this.moderated(this.db, slug, userId);
    const deleted = await this.db.execute(sql`
      delete from book_club_schedule s using book_club_books cb where s.id = ${itemId} and cb.id = s.club_book_id and cb.club_id = ${club.id}`);
    if (!deleted.rowCount) throw AppException.notFound('Schedule');
  }

  // ------------------------------------------------------------------ polls

  private async pollViews(clubId: string, viewerId?: string) {
    const polls = await this.db.select().from(bookClubPolls).where(eq(bookClubPolls.clubId, clubId)).orderBy(sql`${bookClubPolls.createdAt} desc`).limit(5);
    if (!polls.length) return [];
    const ids = polls.map((p) => p.id);
    const [options, mine] = await Promise.all([
      this.db.select().from(bookClubPollOptions).where(inArray(bookClubPollOptions.pollId, ids)).orderBy(bookClubPollOptions.position),
      viewerId ? this.db.select({ optionId: bookClubPollVotes.optionId }).from(bookClubPollVotes).where(and(inArray(bookClubPollVotes.pollId, ids), eq(bookClubPollVotes.userId, viewerId))) : Promise.resolve([]),
    ]);
    const voted = new Set(mine.map((v) => v.optionId));
    return polls.map((p) => {
      const opts = options.filter((o) => o.pollId === p.id);
      return {
        id: p.id,
        question: p.question,
        allowMultiple: p.allowMultiple,
        closesAt: p.closesAt?.toISOString() ?? null,
        open: !p.closesAt || p.closesAt > new Date(),
        totalVotes: opts.reduce((n, o) => n + o.voteCount, 0),
        options: opts.map((o) => ({ id: o.id, label: o.label, votes: o.voteCount, mine: voted.has(o.id) })),
      };
    });
  }

  async createPoll(userId: string, slug: string, input: z.output<typeof pollSchema>) {
    const { club } = await this.moderated(this.db, slug, userId);
    return this.db.transaction(async (tx) => {
      const [poll] = await tx.insert(bookClubPolls).values({ clubId: club.id, question: input.question, allowMultiple: input.allowMultiple, closesAt: input.closesAt ? new Date(input.closesAt) : null, createdBy: userId }).returning();
      await tx.insert(bookClubPollOptions).values(input.options.map((o, i) => ({ pollId: poll!.id, label: o.label, bookId: o.bookId ?? null, position: i })));
      return { id: poll!.id };
    });
  }

  /** Members vote (or change their vote) while the poll is open; counts are recomputed. */
  async vote(userId: string, slug: string, pollId: string, optionIds: string[]) {
    await this.db.transaction(async (tx) => {
      const club = await this.club(tx, slug);
      if (!isActive(await this.member(tx, club.id, userId))) throw AppException.forbidden('api.clubs.membersOnly');
      const [poll] = await tx.select().from(bookClubPolls).where(and(eq(bookClubPolls.id, pollId), eq(bookClubPolls.clubId, club.id))).for('update');
      if (!poll) throw AppException.notFound('Poll');
      if (poll.closesAt && poll.closesAt <= new Date()) throw new AppException('CONFLICT', 'api.clubs.pollClosed');
      const unique = [...new Set(optionIds)];
      if (!poll.allowMultiple && unique.length !== 1) throw AppException.validation([{ field: 'optionIds', code: 'custom', message: 'validation.oneOption' }]);
      const valid = await tx.select({ id: bookClubPollOptions.id }).from(bookClubPollOptions).where(and(eq(bookClubPollOptions.pollId, pollId), inArray(bookClubPollOptions.id, unique)));
      if (valid.length !== unique.length) throw AppException.validation([{ field: 'optionIds', code: 'custom', message: 'validation.invalidChoice' }]);
      await tx.delete(bookClubPollVotes).where(and(eq(bookClubPollVotes.pollId, pollId), eq(bookClubPollVotes.userId, userId)));
      await tx.insert(bookClubPollVotes).values(unique.map((optionId) => ({ pollId, optionId, userId })));
      await tx.execute(sql`update book_club_poll_options o set vote_count = (select count(*)::int from book_club_poll_votes v where v.option_id = o.id) where o.poll_id = ${pollId}`);
    });
    return (await this.pollViews((await this.club(this.db, slug)).id, userId)).find((p) => p.id === pollId)!;
  }
}
