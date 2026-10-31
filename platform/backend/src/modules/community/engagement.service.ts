import { Inject, Injectable } from '@nestjs/common';
import { bookmarks, comments, type Database, likes, posts, users } from '@boikonika/database';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { contentRisk, HOLD_THRESHOLD } from './content-risk';
import { PostsService } from './posts.service';

type Row = Record<string, unknown>;
const COMMENTS_PER_10_MIN = 20;
const XP_MIN_COMMENT = 20;
const REPLIES_SHOWN = 50;

export interface CommentView {
  id: string;
  parentId: string | null;
  body: string | null;
  deleted: boolean;
  pending: boolean;
  likeCount: number;
  replyCount: number;
  liked: boolean;
  mine: boolean;
  canDelete: boolean;
  author: { id: string; username: string; name: string; avatarUrl: string | null };
  createdAt: string;
  editedAt: string | null;
  replies?: CommentView[];
}

/** Likes, bookmarks and threaded comments (one reply level) on community posts. */
@Injectable()
export class EngagementService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly posts: PostsService,
    private readonly storage: StorageService,
    private readonly gamification: GamificationService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------------ likes & bookmarks

  async likePost(userId: string, postId: string, like: boolean) {
    const result = await this.db.transaction(async (tx) => {
      const post = await this.posts.assertVisible(tx, postId, userId);
      if (post.status !== 'published') throw AppException.notFound('Post');
      const changed = like
        ? (await tx.insert(likes).values({ userId, targetType: 'post', targetId: postId }).onConflictDoNothing().returning()).length
        : (await tx.delete(likes).where(and(eq(likes.userId, userId), eq(likes.targetType, 'post'), eq(likes.targetId, postId))).returning()).length;
      const [row] = await tx
        .update(posts)
        .set({ likeCount: changed ? sql`greatest(0, ${posts.likeCount} + ${like ? 1 : -1})` : posts.likeCount })
        .where(eq(posts.id, postId))
        .returning({ likeCount: posts.likeCount });
      // A like earns the author XP once per liker (unlike/relike pays nothing more).
      const rewarded = like && changed && post.authorId !== userId ? await this.gamification.award(tx, post.authorId, 'post_liked', `${postId}${userId}`.replace(/-/g, '')) : 0;
      return { liked: like, likeCount: row!.likeCount, authorId: post.authorId, rewarded };
    });
    if (result.rewarded) await this.gamification.evaluateBadges(result.authorId).catch(() => undefined);
    return { liked: result.liked, likeCount: result.likeCount };
  }

  async bookmarkPost(userId: string, postId: string, save: boolean) {
    return this.db.transaction(async (tx) => {
      await this.posts.assertVisible(tx, postId, userId);
      const changed = save
        ? (await tx.insert(bookmarks).values({ userId, targetType: 'post', targetId: postId }).onConflictDoNothing().returning()).length
        : (await tx.delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.targetType, 'post'), eq(bookmarks.targetId, postId))).returning()).length;
      const [row] = await tx
        .update(posts)
        .set({ bookmarkCount: changed ? sql`greatest(0, ${posts.bookmarkCount} + ${save ? 1 : -1})` : posts.bookmarkCount })
        .where(eq(posts.id, postId))
        .returning({ bookmarkCount: posts.bookmarkCount });
      return { bookmarked: save, bookmarkCount: row!.bookmarkCount };
    });
  }

  async likeComment(userId: string, commentId: string, like: boolean) {
    return this.db.transaction(async (tx) => {
      const [comment] = await tx.select().from(comments).where(and(eq(comments.id, commentId), isNull(comments.deletedAt), eq(comments.status, 'published')));
      if (!comment) throw AppException.notFound('Comment');
      await this.posts.assertVisible(tx, comment.postId, userId);
      const changed = like
        ? (await tx.insert(likes).values({ userId, targetType: 'comment', targetId: commentId }).onConflictDoNothing().returning()).length
        : (await tx.delete(likes).where(and(eq(likes.userId, userId), eq(likes.targetType, 'comment'), eq(likes.targetId, commentId))).returning()).length;
      const [row] = await tx
        .update(comments)
        .set({ likeCount: changed ? sql`greatest(0, ${comments.likeCount} + ${like ? 1 : -1})` : comments.likeCount })
        .where(eq(comments.id, commentId))
        .returning({ likeCount: comments.likeCount });
      return { liked: like, likeCount: row!.likeCount };
    });
  }

  // ------------------------------------------------------------------ comments

  /** Top-level comments oldest first (a conversation), each with its replies. */
  async listComments(postId: string, cursor: string | undefined, limit: number, viewerId?: string) {
    if (viewerId) await this.posts.assertVisible(this.db, postId, viewerId);
    else await this.posts.get(postId);
    const [{ author_id: postAuthor } = { author_id: '' }] = await this.db.execute<{ author_id: string }>(sql`select author_id from posts where id = ${postId}`).then((r) => r.rows);
    let after: { t: string; id: string } | null = null;
    if (cursor) {
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      } catch {
        throw AppException.badRequest('errors.badCursor', 'cursor');
      }
    }
    const visible = sql`(c.status = 'published' ${viewerId ? sql`or c.author_id = ${viewerId}` : sql``}) and (c.deleted_at is null or c.reply_count > 0)
      and u.status = 'active' ${viewerId ? sql`and not exists (select 1 from user_blocks bl where (bl.blocker_id = ${viewerId} and bl.blocked_id = c.author_id) or (bl.blocker_id = c.author_id and bl.blocked_id = ${viewerId}))` : sql``}`;
    const top = await this.db.execute<Row>(sql`
      select c.*, u.username, u.display_name, up.avatar_key from comments c join users u on u.id = c.author_id left join user_profiles up on up.user_id = u.id
      where c.post_id = ${postId} and c.parent_id is null and ${visible}
        ${after ? sql`and (c.created_at, c.id) > (${after.t}::timestamptz, ${after.id}::uuid)` : sql``}
      order by c.created_at, c.id limit ${limit + 1}`);
    const page = top.rows.slice(0, limit);
    const replies = page.length
      ? await this.db.execute<Row>(sql`
          select * from (
            select c.*, u.username, u.display_name, up.avatar_key, row_number() over (partition by c.parent_id order by c.created_at, c.id) as rn
            from comments c join users u on u.id = c.author_id left join user_profiles up on up.user_id = u.id
            where c.parent_id in (${sql.join(page.map((p) => sql`${p.id}::uuid`), sql`, `)}) and ${visible}) r
          where rn <= ${REPLIES_SHOWN} order by created_at, id`)
      : { rows: [] as Row[] };
    const all = [...page, ...replies.rows];
    const likedIds = viewerId && all.length
      ? new Set((await this.db.execute<{ target_id: string }>(sql`select target_id from likes where user_id = ${viewerId} and target_type = 'comment' and target_id in (${sql.join(all.map((c) => sql`${c.id}::uuid`), sql`, `)})`)).rows.map((r) => r.target_id))
      : new Set<string>();
    const view = (c: Row): CommentView => {
      const deleted = !!c.deleted_at;
      return {
        id: c.id as string,
        parentId: (c.parent_id as string | null) ?? null,
        body: deleted ? null : (c.body as string),
        deleted,
        pending: c.status !== 'published',
        likeCount: Number(c.like_count ?? 0),
        replyCount: Number(c.reply_count ?? 0),
        liked: likedIds.has(c.id as string),
        mine: !!viewerId && c.author_id === viewerId,
        canDelete: !deleted && !!viewerId && (c.author_id === viewerId || postAuthor === viewerId),
        author: { id: c.author_id as string, username: c.username as string, name: c.display_name as string, avatarUrl: this.storage.publicUrl(c.avatar_key as string | null) },
        createdAt: new Date(c.created_at as string).toISOString(),
        editedAt: c.edited_at ? new Date(c.edited_at as string).toISOString() : null,
      };
    };
    const last = page[page.length - 1];
    return {
      items: page.map((c) => ({ ...view(c), replies: replies.rows.filter((r) => r.parent_id === c.id).map(view) })),
      nextCursor: top.rows.length > limit && last ? Buffer.from(JSON.stringify({ t: new Date(last.created_at as string).toISOString(), id: last.id })).toString('base64url') : null,
    };
  }

  async addComment(userId: string, postId: string, input: { body: string; parentId?: string }) {
    const result = await this.db.transaction(async (tx) => {
      const post = await this.posts.assertVisible(tx, postId, userId);
      if (post.status !== 'published') throw AppException.notFound('Post');
      await this.posts.assertNotRestricted(tx, userId, 'comment');
      const [{ recent } = { recent: 0 }] = await tx
        .execute<{ recent: number }>(sql`select count(*)::int as recent from comments where author_id = ${userId} and created_at > now() - interval '10 minutes'`)
        .then((r) => r.rows);
      if (recent >= COMMENTS_PER_10_MIN) throw new AppException('RATE_LIMITED', 'api.community.tooManyComments');
      // Replies stay one level deep: answering a reply attaches to its top-level comment.
      let parent: { id: string; authorId: string } | null = null;
      if (input.parentId) {
        const [target] = await tx.select().from(comments).where(and(eq(comments.id, input.parentId), eq(comments.postId, postId)));
        if (!target || target.deletedAt) throw AppException.notFound('Comment');
        const rootId = target.parentId ?? target.id;
        const [root] = target.parentId ? await tx.select().from(comments).where(eq(comments.id, rootId)) : [target];
        parent = { id: rootId, authorId: target.authorId };
        if (!root || root.deletedAt) throw AppException.notFound('Comment');
      }
      const [author] = await tx.select({ createdAt: users.createdAt, name: users.displayName }).from(users).where(eq(users.id, userId));
      const risk = contentRisk({ text: input.body, accountAgeHours: (Date.now() - (author?.createdAt.getTime() ?? Date.now())) / 3_600_000, recentCount: recent, studentZone: post.isStudentZone });
      const status = risk >= HOLD_THRESHOLD ? ('pending_review' as const) : ('published' as const);
      const [row] = await tx.insert(comments).values({ postId, authorId: userId, parentId: parent?.id ?? null, body: input.body, status }).returning();
      if (status === 'published') {
        await tx.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, postId));
        if (parent) await tx.update(comments).set({ replyCount: sql`${comments.replyCount} + 1` }).where(eq(comments.id, parent.id));
        if (input.body.length >= XP_MIN_COMMENT) await this.gamification.award(tx, userId, 'comment', row!.id);
      }
      return { comment: row!, status, post, parent, actorName: author?.name ?? '' };
    });
    if (result.status === 'published') {
      const link = `/posts/${postId}#comment-${result.comment.id}`;
      const notified = new Set<string>([userId]);
      if (result.parent && !notified.has(result.parent.authorId)) {
        notified.add(result.parent.authorId);
        await this.notifications
          .notify(result.parent.authorId, { type: 'comment', titleKey: 'api.community.replyTitle', bodyKey: 'api.community.replyBody', params: { name: result.actorName }, link, actorId: userId, groupKey: `post:${postId}` })
          .catch(() => undefined);
      }
      if (!notified.has(result.post.authorId)) {
        await this.notifications
          .notify(result.post.authorId, { type: 'comment', titleKey: 'api.community.commentTitle', bodyKey: 'api.community.commentBody', params: { name: result.actorName }, link, actorId: userId, groupKey: `post:${postId}` })
          .catch(() => undefined);
      }
    }
    return { id: result.comment.id, status: result.status };
  }

  async editComment(userId: string, id: string, body: string) {
    const [comment] = await this.db.select().from(comments).where(and(eq(comments.id, id), isNull(comments.deletedAt)));
    if (!comment || comment.authorId !== userId) throw AppException.notFound('Comment');
    if (comment.status === 'removed' || comment.status === 'hidden') throw new AppException('FORBIDDEN', 'api.community.locked');
    await this.posts.assertNotRestricted(this.db, userId, 'comment');
    await this.db.update(comments).set({ body, editedAt: new Date(), updatedAt: new Date() }).where(eq(comments.id, id));
    return { id, body };
  }

  /** The comment's author or the post's author can delete it; replies keep their place under a tombstone. */
  async deleteComment(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select({ comment: comments, postAuthor: posts.authorId }).from(comments).innerJoin(posts, eq(posts.id, comments.postId)).where(and(eq(comments.id, id), isNull(comments.deletedAt)));
      if (!row || (row.comment.authorId !== userId && row.postAuthor !== userId)) throw AppException.notFound('Comment');
      await tx.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, id));
      if (row.comment.status === 'published') {
        await tx.update(posts).set({ commentCount: sql`greatest(0, ${posts.commentCount} - 1)` }).where(eq(posts.id, row.comment.postId));
        if (row.comment.parentId) await tx.update(comments).set({ replyCount: sql`greatest(0, ${comments.replyCount} - 1)` }).where(eq(comments.id, row.comment.parentId));
      }
    });
  }
}
