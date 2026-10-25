import { Inject, Injectable } from '@nestjs/common';
import { books, type Database, type DbOrTx, postMedia, posts, users } from '@boikonika/database';
import { MAX_POST_IMAGES, MAX_QUOTE_LENGTH, type FeedTab, type feedQuerySchema, type postSchema, type postUpdateSchema } from '@boikonika/shared';
import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { processUpload } from '../../infra/storage/uploads';
import { GamificationService } from '../gamification/gamification.service';
import { contentRisk, HOLD_THRESHOLD } from './content-risk';

type Row = Record<string, unknown>;
const POSTS_PER_HOUR = 10;
/** Posts long enough to be a real contribution earn XP; one-liners do not. */
const XP_MIN_LENGTH = 80;
const FOR_YOU_WINDOW_DAYS = 30;

export interface PostView {
  id: string;
  type: string;
  title: string | null;
  body: string;
  quoteSource: string | null;
  readingPercent: number | null;
  visibility: string;
  studentZone: boolean;
  subject: string | null;
  status: string;
  book: { id: string; slug: string; title: string; coverUrl: string | null; authors: string[] } | null;
  media: Array<{ url: string; alt: string | null; width: number | null; height: number | null }>;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  liked: boolean;
  bookmarked: boolean;
  mine: boolean;
  author: { id: string; username: string; name: string; avatarUrl: string | null; isAuthor: boolean };
  createdAt: string;
  editedAt: string | null;
}

const encodeCursor = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url');
function decodeCursor<T>(cursor?: string): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    throw AppException.badRequest('errors.badCursor', 'cursor');
  }
}

/** Posts the viewer may see: published (or their own), visible to them, from active accounts, no blocks either way. */
export function visibleTo(viewerId?: string): SQL {
  const base = sql`p.deleted_at is null and u.status = 'active' and u.deleted_at is null`;
  if (!viewerId) return sql`${base} and p.status = 'published' and p.visibility = 'public'`;
  return sql`${base} and (
      (p.author_id = ${viewerId} and p.status <> 'removed')
      or (p.status = 'published' and (p.visibility = 'public'
        or (p.visibility = 'followers' and exists (select 1 from follows f where f.follower_id = ${viewerId} and f.target_type = 'user' and f.target_id = p.author_id)))))
    and not exists (select 1 from user_blocks bl where (bl.blocker_id = ${viewerId} and bl.blocked_id = p.author_id) or (bl.blocker_id = p.author_id and bl.blocked_id = ${viewerId}))`;
}

const POST_COLUMNS = sql`p.*, u.username, u.display_name, up.avatar_key, exists (select 1 from authors a where a.user_id = u.id and a.is_verified) as is_author`;
const POST_FROM = sql`from posts p join users u on u.id = p.author_id left join user_profiles up on up.user_id = u.id`;

@Injectable()
export class PostsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly gamification: GamificationService,
  ) {}

  /** Active moderation restrictions block posting/commenting for their scope. */
  async assertNotRestricted(tx: DbOrTx, userId: string, scope: 'post' | 'comment'): Promise<void> {
    const rows = await tx.execute(sql`
      select 1 from user_restrictions where user_id = ${userId} and lifted_at is null and (until is null or until > now()) and scope in (${scope}, 'all') limit 1`);
    if (rows.rows.length) throw new AppException('FORBIDDEN', 'api.community.restricted');
  }

  async create(userId: string, input: z.output<typeof postSchema>, images: Buffer[]): Promise<PostView> {
    if (images.length > MAX_POST_IMAGES) throw AppException.validation([{ field: 'images', code: 'too_many', message: 'validation.tooManyImages' }]);
    if (input.type === 'artwork' && !images.length) throw AppException.validation([{ field: 'images', code: 'required', message: 'validation.imageRequired' }]);
    await this.assertNotRestricted(this.db, userId, 'post');
    const [author] = await this.db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
    const [{ recent } = { recent: 0 }] = await this.db
      .execute<{ recent: number }>(sql`select count(*)::int as recent from posts where author_id = ${userId} and created_at > now() - interval '1 hour'`)
      .then((r) => r.rows);
    if (recent >= POSTS_PER_HOUR) throw new AppException('RATE_LIMITED', 'api.community.tooManyPosts');
    if (input.bookId) {
      const [book] = await this.db.select({ id: books.id }).from(books).where(and(eq(books.id, input.bookId), eq(books.status, 'published'), isNull(books.deletedAt)));
      if (!book) throw AppException.validation([{ field: 'bookId', code: 'not_found', message: 'validation.bookRequired' }]);
    }
    const processed = await Promise.all(
      images.map((buffer) => processUpload(buffer, { allowed: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024, image: { maxWidth: 2000, maxHeight: 2000, format: 'webp', quality: 82 } })),
    );
    const risk = contentRisk({
      text: `${input.title ?? ''}\n${input.body}\n${input.quoteSource ?? ''}`,
      accountAgeHours: (Date.now() - (author?.createdAt.getTime() ?? Date.now())) / 3_600_000,
      recentCount: recent,
      studentZone: input.studentZone,
      hasImages: images.length > 0,
    });
    const status = risk >= HOLD_THRESHOLD ? 'pending_review' : 'published';
    const id = randomUUID();
    const keys = processed.map((p) => `posts/${id}/${randomUUID()}.${p.extension}`);
    await Promise.all(processed.map((p, i) => this.storage.put('public', keys[i]!, p.body, p.contentType)));
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(posts).values({
          id,
          authorId: userId,
          type: input.type,
          title: input.title || null,
          body: input.body,
          bookId: input.bookId ?? null,
          quoteSource: input.quoteSource || null,
          readingPercent: input.type === 'reading_progress' ? (input.readingPercent ?? null) : null,
          visibility: input.visibility,
          status,
          isStudentZone: input.studentZone,
          subject: input.subject ?? null,
          language: /[ঀ-৿]/.test(input.body) ? 'bn' : 'en',
        });
        if (processed.length) {
          await tx.insert(postMedia).values(processed.map((p, i) => ({ postId: id, storageKey: keys[i]!, kind: 'image', width: p.width ?? null, height: p.height ?? null, position: i })));
        }
        if (status === 'published') await this.rewardPublished(tx, userId, id, input.body);
      });
    } catch (error) {
      await Promise.all(keys.map((k) => this.storage.delete('public', k).catch(() => undefined)));
      throw error;
    }
    if (status === 'published') await this.gamification.evaluateBadges(userId).catch(() => undefined);
    return this.get(id, userId);
  }

  /** XP and counters for a post that went live (also used when a moderator approves one). */
  async rewardPublished(tx: DbOrTx, userId: string, postId: string, body: string): Promise<void> {
    await this.gamification.bump(tx, userId, { postsPublished: 1 });
    if (body.length >= XP_MIN_LENGTH) await this.gamification.award(tx, userId, 'post', postId);
  }

  async update(userId: string, id: string, input: z.output<typeof postUpdateSchema>): Promise<PostView> {
    const [post] = await this.db.select().from(posts).where(and(eq(posts.id, id), isNull(posts.deletedAt)));
    if (!post || post.authorId !== userId) throw AppException.notFound('Post');
    if (post.status === 'removed' || post.status === 'hidden') throw new AppException('FORBIDDEN', 'api.community.locked');
    await this.assertNotRestricted(this.db, userId, 'post');
    const body = input.body ?? post.body;
    if (post.type === 'quote' && body.length > MAX_QUOTE_LENGTH) throw AppException.validation([{ field: 'body', code: 'too_long', message: 'validation.quoteTooLong' }]);
    const [author] = await this.db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
    const risk = contentRisk({ text: `${input.title ?? post.title ?? ''}\n${body}`, accountAgeHours: (Date.now() - (author?.createdAt.getTime() ?? Date.now())) / 3_600_000, recentCount: 0, studentZone: post.isStudentZone });
    await this.db
      .update(posts)
      .set({
        ...(input.title !== undefined ? { title: input.title || null } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        // An edit that turns a live post risky sends it back for review.
        ...(risk >= HOLD_THRESHOLD ? { status: 'pending_review' as const } : {}),
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
    return this.get(id, userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.db
      .update(posts)
      .set({ deletedAt: new Date() })
      .where(and(eq(posts.id, id), eq(posts.authorId, userId), isNull(posts.deletedAt)))
      .returning({ id: posts.id, keys: sql<string[]>`(select coalesce(array_agg(storage_key), '{}') from post_media where post_id = ${id})` });
    if (!result.length) throw AppException.notFound('Post');
    await this.db.delete(postMedia).where(eq(postMedia.postId, id));
    await Promise.all((result[0]!.keys ?? []).map((k) => this.storage.delete('public', k).catch(() => undefined)));
  }

  async get(id: string, viewerId?: string): Promise<PostView> {
    const rows = await this.db.execute<Row>(sql`select ${POST_COLUMNS} ${POST_FROM} where p.id = ${id} and ${visibleTo(viewerId)}`);
    if (!rows.rows.length) throw AppException.notFound('Post');
    return (await this.hydrate(rows.rows, viewerId))[0]!;
  }

  /** Throws unless the viewer can see (and so interact with) the post; returns its author. */
  async assertVisible(tx: DbOrTx, id: string, viewerId: string): Promise<{ authorId: string; status: string; type: string; isStudentZone: boolean }> {
    const rows = await tx.execute<{ author_id: string; status: string; type: string; is_student_zone: boolean }>(sql`select p.author_id, p.status, p.type, p.is_student_zone ${POST_FROM} where p.id = ${id} and ${visibleTo(viewerId)}`);
    const row = rows.rows[0];
    if (!row) throw AppException.notFound('Post');
    return { authorId: row.author_id, status: row.status, type: row.type, isStudentZone: row.is_student_zone };
  }

  /** Book picker for the composer: any published book (bought or not), title or author matches. */
  async findBooks(raw: string) {
    const q = raw.normalize('NFC').trim().slice(0, 100);
    if (q.length < 2) return [];
    const prefix = `${q.replace(/[%_\\]/g, '')}%`;
    const rows = await this.db.execute<Row>(sql`
      select b.id, b.slug, b.title, b.cover_key,
        coalesce((select array_agg(a.name order by ba.position) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id), '{}') as authors
      from books b where b.status = 'published' and b.deleted_at is null
        and (b.title ilike ${prefix} or b.title % ${q} or ${q} <% b.title or ${q} <% b.search_text)
      order by (case when b.title ilike ${prefix} then 2 else 0 end + greatest(similarity(b.title, ${q}), word_similarity(${q}, b.search_text))) desc, b.sales_count desc
      limit 8`);
    return rows.rows.map((b) => ({ id: b.id as string, slug: b.slug as string, title: b.title as string, coverUrl: this.storage.publicUrl(b.cover_key as string | null), authors: (b.authors as string[]) ?? [] }));
  }

  // ------------------------------------------------------------------ feeds

  async feed(q: z.output<typeof feedQuerySchema>, viewerId?: string) {
    const filters: SQL[] = [visibleTo(viewerId)];
    if (q.type) filters.push(sql`p.type = ${q.type}`);
    if (q.studentZone !== undefined) filters.push(sql`p.is_student_zone = ${q.studentZone}`);
    if (q.subject) filters.push(sql`p.subject = ${q.subject}`);
    const tab: FeedTab = q.tab === 'following' && !viewerId ? 'latest' : q.tab;
    if (tab === 'following') {
      filters.push(sql`(p.author_id = ${viewerId}
        or p.author_id in (select f.target_id from follows f where f.follower_id = ${viewerId} and f.target_type = 'user')
        or p.author_id in (select a.user_id from authors a join follows f on f.target_type = 'author' and f.target_id = a.id where f.follower_id = ${viewerId} and a.user_id is not null))`);
    }
    if (tab === 'for_you') return this.rankedFeed(filters, q.limit, q.cursor, viewerId);
    return this.chronological(filters, q.limit, q.cursor, viewerId);
  }

  async byUser(username: string, cursor: string | undefined, limit: number, viewerId?: string) {
    const [owner] = await this.db.select({ id: users.id }).from(users).where(eq(users.username, username.toLowerCase()));
    if (!owner) throw AppException.notFound('User');
    return this.chronological([visibleTo(viewerId), sql`p.author_id = ${owner.id}`], limit, cursor, viewerId);
  }

  async byBook(slug: string, cursor: string | undefined, limit: number, viewerId?: string) {
    return this.chronological([visibleTo(viewerId), sql`p.book_id = (select id from books where slug = ${slug})`], limit, cursor, viewerId);
  }

  async bookmarked(userId: string, cursor: string | undefined, limit: number) {
    const after = decodeCursor<{ t: string; id: string }>(cursor);
    const rows = await this.db.execute<Row>(sql`
      select ${POST_COLUMNS}, bm.created_at as saved_at ${POST_FROM}
      join bookmarks bm on bm.target_type = 'post' and bm.target_id = p.id and bm.user_id = ${userId}
      where ${visibleTo(userId)} ${after ? sql`and (bm.created_at, p.id) < (${after.t}::timestamptz, ${after.id}::uuid)` : sql``}
      order by bm.created_at desc, p.id desc limit ${limit + 1}`);
    const page = rows.rows.slice(0, limit);
    const last = page[page.length - 1];
    return { items: await this.hydrate(page, userId), nextCursor: rows.rows.length > limit && last ? encodeCursor({ t: new Date(last.saved_at as string).toISOString(), id: last.id }) : null };
  }

  private async chronological(filters: SQL[], limit: number, cursor: string | undefined, viewerId?: string) {
    const after = decodeCursor<{ t: string; id: string }>(cursor);
    if (after) filters.push(sql`(p.created_at, p.id) < (${after.t}::timestamptz, ${after.id}::uuid)`);
    const rows = await this.db.execute<Row>(sql`select ${POST_COLUMNS} ${POST_FROM} where ${sql.join(filters, sql` and `)} order by p.created_at desc, p.id desc limit ${limit + 1}`);
    const page = rows.rows.slice(0, limit);
    const last = page[page.length - 1];
    return { items: await this.hydrate(page, viewerId), nextCursor: rows.rows.length > limit && last ? encodeCursor({ t: new Date(last.created_at as string).toISOString(), id: last.id }) : null };
  }

  /**
   * "For you": recent posts ranked by engagement with time decay, boosted for people the viewer
   * follows and books in their interests. The cursor pins the snapshot time so pages stay stable.
   */
  private async rankedFeed(filters: SQL[], limit: number, cursor: string | undefined, viewerId?: string) {
    const state = decodeCursor<{ at: string; o: number }>(cursor) ?? { at: new Date().toISOString(), o: 0 };
    const offset = Math.max(0, Math.min(Number(state.o) || 0, 500));
    filters.push(sql`p.created_at <= ${state.at}::timestamptz and p.created_at > ${state.at}::timestamptz - make_interval(days => ${FOR_YOU_WINDOW_DAYS})`);
    const followBoost = viewerId
      ? sql`case when exists (select 1 from follows f where f.follower_id = ${viewerId} and f.target_type = 'user' and f.target_id = p.author_id) then 1.8 else 1 end`
      : sql`1`;
    const interestBoost = viewerId
      ? sql`case when p.book_id is not null and exists (
          select 1 from book_categories bc join categories c on c.id = bc.category_id join user_interests ui on ui.user_id = ${viewerId}
          where bc.book_id = p.book_id and c.path ~ ('(^|/)' || replace(ui.interest, '_', '-') || '($|/)')) then 1.5 else 1 end`
      : sql`1`;
    const rows = await this.db.execute<Row>(sql`
      select ${POST_COLUMNS} ${POST_FROM}
      where ${sql.join(filters, sql` and `)}
      order by ((1 + p.like_count + 2 * p.comment_count + 2 * p.bookmark_count) * ${followBoost} * ${interestBoost}
        / power(extract(epoch from (${state.at}::timestamptz - p.created_at)) / 3600 + 2, 1.4)) desc, p.created_at desc, p.id desc
      limit ${limit + 1} offset ${offset}`);
    const page = rows.rows.slice(0, limit);
    return { items: await this.hydrate(page, viewerId), nextCursor: rows.rows.length > limit && offset + limit < 500 ? encodeCursor({ at: state.at, o: offset + limit }) : null };
  }

  /** Adds media, the tagged book and the viewer's like/bookmark state to post rows. */
  async hydrate(rows: Row[], viewerId?: string): Promise<PostView[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id as string);
    const bookIds = [...new Set(rows.map((r) => r.book_id as string | null).filter((v): v is string => !!v))];
    const [media, bookRows, liked, saved] = await Promise.all([
      this.db.select().from(postMedia).where(inArray(postMedia.postId, ids)).orderBy(postMedia.position),
      bookIds.length
        ? this.db.execute<Row>(sql`
            select b.id, b.slug, b.title, b.cover_key,
              coalesce((select array_agg(a.name order by ba.position) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id), '{}') as authors
            from books b where b.id in (${sql.join(bookIds.map((b) => sql`${b}::uuid`), sql`, `)})`)
        : Promise.resolve({ rows: [] as Row[] }),
      viewerId
        ? this.db.execute<{ target_id: string }>(sql`select target_id from likes where user_id = ${viewerId} and target_type = 'post' and target_id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`)
        : Promise.resolve({ rows: [] as Array<{ target_id: string }> }),
      viewerId
        ? this.db.execute<{ target_id: string }>(sql`select target_id from bookmarks where user_id = ${viewerId} and target_type = 'post' and target_id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`)
        : Promise.resolve({ rows: [] as Array<{ target_id: string }> }),
    ]);
    const likedSet = new Set(liked.rows.map((r) => r.target_id));
    const savedSet = new Set(saved.rows.map((r) => r.target_id));
    const bookMap = new Map(bookRows.rows.map((b) => [b.id as string, { id: b.id as string, slug: b.slug as string, title: b.title as string, coverUrl: this.storage.publicUrl(b.cover_key as string | null), authors: (b.authors as string[]) ?? [] }]));
    return rows.map((r) => ({
      id: r.id as string,
      type: r.type as string,
      title: (r.title as string | null) ?? null,
      body: r.body as string,
      quoteSource: (r.quote_source as string | null) ?? null,
      readingPercent: r.reading_percent === null || r.reading_percent === undefined ? null : Number(r.reading_percent),
      visibility: r.visibility as string,
      studentZone: r.is_student_zone === true,
      subject: (r.subject as string | null) ?? null,
      status: r.status as string,
      book: r.book_id ? (bookMap.get(r.book_id as string) ?? null) : null,
      media: media.filter((m) => m.postId === r.id).map((m) => ({ url: this.storage.publicUrl(m.storageKey)!, alt: m.alt, width: m.width, height: m.height })),
      likeCount: Number(r.like_count ?? 0),
      commentCount: Number(r.comment_count ?? 0),
      bookmarkCount: Number(r.bookmark_count ?? 0),
      liked: likedSet.has(r.id as string),
      bookmarked: savedSet.has(r.id as string),
      mine: !!viewerId && r.author_id === viewerId,
      author: { id: r.author_id as string, username: r.username as string, name: r.display_name as string, avatarUrl: this.storage.publicUrl(r.avatar_key as string | null), isAuthor: r.is_author === true },
      createdAt: new Date(r.created_at as string).toISOString(),
      editedAt: r.edited_at ? new Date(r.edited_at as string).toISOString() : null,
    }));
  }
}
