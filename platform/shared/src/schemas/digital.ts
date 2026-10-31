import { z } from 'zod';
import { DIGITAL_CAPACITIES, MAX_SAMPLE_CHAPTER_CHARS, PREVIEW_PERCENT_CEILING } from '../constants/digital';
import { moneySchema, nfcText } from './catalog';

/** Sent as JSON in the `data` field next to the uploaded e-book file. */
export const digitalUploadSchema = z.object({
  capacity: z.enum(DIGITAL_CAPACITIES, { error: 'validation.invalidChoice' }),
  accepted: z.literal(true, { error: 'validation.declaration' }),
});
export type DigitalUploadInput = z.input<typeof digitalUploadSchema>;

/** Free to every reader, or sold at a price through the rights holder's store. */
export const digitalOfferSchema = z
  .object({
    free: z.boolean(),
    price: moneySchema.optional(),
    compareAtPrice: moneySchema.optional(),
  })
  .refine((v) => v.free || (v.price !== undefined && Number(v.price) >= 10), { error: 'validation.digitalPrice', path: ['price'] })
  .refine((v) => v.free || !v.compareAtPrice || Number(v.compareAtPrice) >= Number(v.price), { error: 'validation.compareAtPrice', path: ['compareAtPrice'] });
export type DigitalOfferInput = z.input<typeof digitalOfferSchema>;

export const previewPercentSchema = z.object({
  previewPercent: z.coerce.number().int({ error: 'validation.integer' }).min(1, { error: 'validation.integer' }).max(PREVIEW_PERCENT_CEILING, { error: 'validation.integer' }),
});

/** A sample chapter typed or pasted by the rights holder (plain text; blank lines separate paragraphs). */
export const sampleChapterSchema = z.object({
  title: nfcText(1, 200),
  content: z
    .string({ error: 'validation.required' })
    .transform((v) => v.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim())
    .pipe(z.string().min(200, { error: 'validation.sampleTooShort' }).max(MAX_SAMPLE_CHAPTER_CHARS, { error: 'validation.maxLength' })),
});
export type SampleChapterInput = z.input<typeof sampleChapterSchema>;

export const takedownSchema = z.object({ reason: nfcText(10, 1000) });
