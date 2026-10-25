import { z } from 'zod';
import { LIBRARY_SHELVES } from '../constants/statuses';

const int = (min: number, max: number, error = 'validation.integer') => z.coerce.number().int({ error }).min(min, { error }).max(max, { error });

export const libraryShelfSchema = z.object({ shelf: z.enum(LIBRARY_SHELVES, { error: 'validation.invalidChoice' }) });
export const libraryQuerySchema = z.object({
  shelf: z.enum(LIBRARY_SHELVES).optional(),
  /** Only books whose e-book I can download. */
  digital: z
    .enum(['1', 'true', '0', 'false'])
    .transform((v) => v === '1' || v === 'true')
    .optional(),
  page: int(1, 500).default(1),
  pageSize: int(1, 60).default(24),
});

/** Where I am in a book (corrects the position; reading time is logged with sessions). */
export const progressSchema = z
  .object({ currentPage: int(0, 20000), totalPages: int(1, 20000).optional(), finished: z.boolean().optional() })
  .refine((v) => v.totalPages === undefined || v.currentPage <= v.totalPages, { error: 'validation.pageBeyondEnd', path: ['currentPage'] });

/**
 * A reading session from the timer or logged by hand. With a book and `currentPage`, the pages read
 * are worked out from the previous position.
 */
export const readingSessionSchema = z
  .object({
    bookId: z.uuid().optional(),
    minutes: int(1, 600, 'validation.minutes'),
    pages: int(0, 2000).optional(),
    currentPage: int(0, 20000).optional(),
    startedAt: z.iso.datetime({ offset: true }).optional(),
    source: z.enum(['timer', 'manual']).default('manual'),
  })
  .refine((v) => v.currentPage === undefined || !!v.bookId, { error: 'validation.bookRequired', path: ['bookId'] })
  .refine((v) => !v.startedAt || (Date.parse(v.startedAt) <= Date.now() + 60_000 && Date.parse(v.startedAt) > Date.now() - 8 * 86_400_000), { error: 'validation.sessionDate', path: ['startedAt'] });

export const readingGoalsSchema = z.object({
  dailyMinutes: int(1, 600),
  weeklyMinutes: int(1, 4200),
  yearlyBooks: int(1, 365),
  breakReminderMinutes: int(10, 180).nullable(),
  monthlySummaryEmail: z.boolean(),
});

export const statsQuerySchema = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d), { error: 'validation.invalidChoice' }).default(30) });
