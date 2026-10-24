import { z } from 'zod';
import { AppException } from '../errors/app-exception';

/** Cursor pagination query: `?limit=20&cursor=<opaque>` (feeds, catalogue, notifications). */
export const cursorQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(500).optional(),
});
export type CursorQuery = z.infer<typeof cursorQuery>;

/** Offset pagination query: `?page=1&pageSize=25` (admin tables that need totals). */
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PageQuery = z.infer<typeof pageQuery>;

/** Opaque cursor: base64url JSON of the sort key(s) of the last item. */
export function encodeCursor(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor<T extends Record<string, string | number>>(cursor: string | undefined, schema: z.ZodType<T>): T | undefined {
  if (!cursor) return undefined;
  try {
    return schema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
  } catch {
    throw AppException.badRequest('Invalid pagination cursor', 'cursor');
  }
}

/** Fetch `limit + 1` rows and call this to split the extra row into `nextCursor`. */
export function sliceWithCursor<T>(rows: T[], limit: number, toCursor: (last: T) => Record<string, string | number>) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? encodeCursor(toCursor(last)) : null };
}
