import { z } from 'zod';
import { COMPOSER_POST_TYPES, FEED_TABS, MAX_COMMENT_LENGTH, MAX_POST_LENGTH, MAX_QUOTE_LENGTH, REPORT_TARGET_TYPES, STUDY_SUBJECTS } from '../constants/community';
import { REPORT_REASONS, VISIBILITIES } from '../constants/statuses';
import { nfcText } from './catalog';

/** Multi-line text: NFC, Windows line breaks normalised, at most two blank lines in a row, trimmed. */
const body = (max: number) =>
  z
    .string({ error: 'validation.required' })
    .max(max * 2)
    .transform((v) => v.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim())
    .pipe(z.string().min(1, { error: 'validation.required' }).max(max, { error: 'validation.maxLength' }));

export const postSchema = z
  .object({
    type: z.enum(COMPOSER_POST_TYPES, { error: 'validation.invalidChoice' }),
    title: nfcText(0, 200).optional(),
    body: body(MAX_POST_LENGTH),
    bookId: z.uuid().optional(),
    quoteSource: nfcText(0, 200).optional(),
    readingPercent: z.coerce.number().int().min(0, { error: 'validation.percent' }).max(100, { error: 'validation.percent' }).optional(),
    visibility: z.enum(VISIBILITIES).default('public'),
    studentZone: z.boolean().default(false),
    subject: z.enum(STUDY_SUBJECTS, { error: 'validation.invalidChoice' }).optional(),
    /** Artwork must be the poster's own work. */
    originalWork: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'quote') {
      if (v.body.length > MAX_QUOTE_LENGTH) ctx.addIssue({ code: 'custom', path: ['body'], message: 'validation.quoteTooLong' });
      if (!v.bookId && !v.quoteSource) ctx.addIssue({ code: 'custom', path: ['quoteSource'], message: 'validation.quoteSource' });
    }
    if (v.type === 'reading_progress') {
      if (!v.bookId) ctx.addIssue({ code: 'custom', path: ['bookId'], message: 'validation.bookRequired' });
      if (v.readingPercent === undefined) ctx.addIssue({ code: 'custom', path: ['readingPercent'], message: 'validation.required' });
    }
    if (v.type === 'artwork' && v.originalWork !== true) ctx.addIssue({ code: 'custom', path: ['originalWork'], message: 'validation.originalWork' });
    if (v.studentZone && !v.subject) ctx.addIssue({ code: 'custom', path: ['subject'], message: 'validation.required' });
  });
export type PostInput = z.input<typeof postSchema>;

export const postUpdateSchema = z.object({
  title: nfcText(0, 200).nullable().optional(),
  body: body(MAX_POST_LENGTH).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
});

export const commentSchema = z.object({ body: body(MAX_COMMENT_LENGTH), parentId: z.uuid().optional() });
export const commentUpdateSchema = z.object({ body: body(MAX_COMMENT_LENGTH) });

export const feedQuerySchema = z.object({
  tab: z.enum(FEED_TABS).default('for_you'),
  cursor: z.string().max(200).optional(),
  type: z.enum(COMPOSER_POST_TYPES).optional(),
  studentZone: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  subject: z.enum(STUDY_SUBJECTS).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(15),
});

export const cursorQuerySchema = z.object({ cursor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });

export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS, { error: 'validation.invalidChoice' }),
  details: z
    .string()
    .max(2000)
    .transform((v) => v.normalize('NFC').trim())
    .optional(),
});
