import { z } from 'zod';
import { nfcText } from './catalog';

const longText = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((v) => v.normalize('NFC').replace(/\r\n/g, '\n').trim())
    .pipe(z.string().max(max, { error: 'validation.maxLength' }));

const website = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+\.[^\s]+$/.test(v), { error: 'validation.url' })
  .transform((v) => v || null)
  .nullable()
  .optional();

const year = (min: number) => z.coerce.number().int().min(min, { error: 'validation.year' }).max(new Date().getFullYear(), { error: 'validation.year' }).nullable().optional();

/** Write or edit a review of a book (readers) or product (buyers). */
export const reviewSchema = z
  .object({
    bookId: z.uuid().optional(),
    productId: z.uuid().optional(),
    rating: z.coerce.number().int().min(1, { error: 'validation.rating' }).max(5, { error: 'validation.rating' }),
    title: nfcText(0, 160).optional(),
    body: longText(5000).optional(),
  })
  .refine((v) => !!v.bookId !== !!v.productId, { error: 'validation.required', path: ['bookId'] });
export const reviewUpdateSchema = z.object({ rating: z.coerce.number().int().min(1).max(5).optional(), title: nfcText(0, 160).nullable().optional(), body: longText(5000).nullable().optional() });
export const reviewListQuerySchema = z.object({
  sort: z.enum(['helpful', 'newest', 'highest', 'lowest']).default('helpful'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  verified: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export const reviewVoteSchema = z.object({ helpful: z.boolean() });
export const reviewReplySchema = z.object({ body: longText(2000).pipe(z.string().min(2, { error: 'validation.required' })) });

export const authorProfileSchema = z.object({
  nameAlt: nfcText(0, 160).nullable().optional(),
  bio: longText(5000).nullable().optional(),
  website,
  birthYear: year(1000),
});

export const authorAnnouncementSchema = z.object({
  title: nfcText(3, 120),
  body: longText(1000).pipe(z.string().min(10, { error: 'validation.tooShort' })),
  bookId: z.uuid().optional(),
});

export const authorClaimSchema = z.object({
  authorId: z.uuid(),
  message: longText(2000).pipe(z.string().min(20, { error: 'validation.tooShort' })),
  evidenceUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https:\/\/[^\s]+\.[^\s]+$/.test(v), { error: 'validation.httpsUrl' })
    .transform((v) => v || undefined)
    .optional(),
});
export const claimDecisionSchema = z.object({ reason: longText(1000).optional() });

export const publisherProfileSchema = z.object({
  nameAlt: nfcText(0, 200).nullable().optional(),
  description: longText(5000).nullable().optional(),
  website,
  foundedYear: year(1800),
});
