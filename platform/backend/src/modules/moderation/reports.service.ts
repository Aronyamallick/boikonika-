import { Inject, Injectable } from '@nestjs/common';
import { type Database, reports } from '@boikonika/database';
import type { reportSchema } from '@boikonika/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';

/** Reasons that put a report at the front of the queue. */
const URGENT_REASONS = new Set(['scam', 'fraud', 'harassment', 'abuse']);
/** Distinct open reports after which a post or comment is hidden until a moderator looks at it. */
export const AUTO_HIDE_REPORTS = 5;

/** Where each reportable thing lives and who owns it. */
const TARGETS: Record<string, { table: string; owner: string; counter?: string; hideable?: boolean; extra?: string }> = {
  post: { table: 'posts', owner: 'author_id', counter: 'report_count', hideable: true, extra: 'is_student_zone' },
  comment: { table: 'comments', owner: 'author_id', counter: 'report_count', hideable: true },
  review: { table: 'reviews', owner: 'user_id', counter: 'report_count' },
  product: { table: 'products', owner: '(select s.user_id from sellers s where s.id = t.seller_id)' },
  book: { table: 'books', owner: 'null::uuid' },
  user: { table: 'users', owner: 'id' },
  club: { table: 'book_clubs', owner: 'owner_id' },
  club_post: { table: 'book_club_posts', owner: 'author_id' },
  store: { table: 'seller_stores', owner: '(select s.user_id from sellers s where s.id = t.seller_id)' },
};

@Injectable()
export class ReportsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Files a report (once per reporter per item while it is open). */
  async create(reporterId: string, input: z.output<typeof reportSchema>) {
    const target = TARGETS[input.targetType]!;
    return this.db.transaction(async (tx) => {
      const found = await tx.execute<{ owner: string | null; student: boolean | null }>(
        sql`select ${sql.raw(target.owner)} as owner, ${sql.raw(target.extra ? `t.${target.extra}` : 'false')} as student from ${sql.raw(target.table)} t where t.id = ${input.targetId}`,
      );
      const row = found.rows[0];
      if (!row) throw AppException.notFound();
      if (row.owner === reporterId) throw AppException.badRequest('api.moderation.ownContent');
      const [open] = await tx
        .select({ id: reports.id })
        .from(reports)
        .where(and(eq(reports.reporterId, reporterId), eq(reports.targetType, input.targetType), eq(reports.targetId, input.targetId), inArray(reports.status, ['reported', 'under_review'])));
      if (open) return { id: open.id, duplicate: true };
      const [created] = await tx
        .insert(reports)
        .values({
          reporterId,
          targetType: input.targetType,
          targetId: input.targetId,
          targetUserId: row.owner,
          reason: input.reason,
          details: input.details || null,
          // Student Zone content and scams/harassment are looked at first.
          priority: URGENT_REASONS.has(input.reason) || row.student ? 'high' : 'normal',
        })
        .returning({ id: reports.id });
      if (target.counter) {
        await tx.execute(sql`update ${sql.raw(target.table)} set ${sql.raw(target.counter)} = ${sql.raw(target.counter)} + 1 where id = ${input.targetId}`);
      }
      if (target.hideable) {
        const [{ n } = { n: 0 }] = await tx
          .execute<{ n: number }>(sql`select count(distinct reporter_id)::int as n from reports where target_type = ${input.targetType} and target_id = ${input.targetId} and status in ('reported', 'under_review')`)
          .then((r) => r.rows);
        if (n >= AUTO_HIDE_REPORTS) {
          await tx.execute(sql`update ${sql.raw(target.table)} set status = 'pending_review' where id = ${input.targetId} and status = 'published'`);
        }
      }
      return { id: created!.id, duplicate: false };
    });
  }
}
