import { z } from 'zod';
import {
  ARTICLE_AUDIENCES,
  ARTICLE_KINDS,
  BANNER_PLACEMENTS,
  BOOK_SOURCES,
  CONTACT_STATUSES,
  CONTACT_TOPICS,
  FAQ_CATEGORIES,
  HOMEPAGE_SECTION_TYPES,
  MAX_ARTICLE_BODY,
  MAX_MANUAL_BOOKS,
  MAX_PAGE_BODY,
  MAX_SECTION_ITEMS,
  PAGE_SLUG_PATTERN,
  SINGLE_SECTION_TYPES,
} from '../constants/cms';
import { LOCALES } from '../i18n/locales';
import { nfcText } from './catalog';
import { bdPhoneSchema } from './common';

const page = { page: z.coerce.number().int().min(1).max(10_000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) };

/** Multi-line text (Markdown): NFC, Windows line breaks normalised, at most one blank line in a row, trimmed. */
export const multilineText = (min: number, max: number) =>
  z
    .string({ error: 'validation.required' })
    .max(max * 2)
    .transform((v) => v.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim())
    .pipe(z.string().min(min, { error: min > 1 ? 'validation.tooShort' : 'validation.required' }).max(max, { error: 'validation.maxLength' }));

/** Text staff write in both languages; every reader sees their own. */
const both = (min: number, max: number) => z.object({ bn: nfcText(min, max), en: nfcText(min, max) });
const bothMultiline = (min: number, max: number) => z.object({ bn: multilineText(min, max), en: multilineText(min, max) });
/** Optional bilingual text: empty in both languages means "none". */
const optionalBoth = (max: number) =>
  z
    .object({ bn: z.string().max(max * 2).default(''), en: z.string().max(max * 2).default('') })
    .transform((v) => ({ bn: v.bn.normalize('NFC').replace(/\s+/g, ' ').trim(), en: v.en.normalize('NFC').replace(/\s+/g, ' ').trim() }))
    .pipe(z.object({ bn: z.string().max(max, { error: 'validation.maxLength' }), en: z.string().max(max, { error: 'validation.maxLength' }) }))
    .transform((v) => (v.bn || v.en ? v : null))
    .nullable()
    .optional();

/** Where a banner or link may point: a page on this site ("/books") or a secure external address. */
export const siteLinkSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/(?![/\\])[^\s]*$/.test(v) || /^https:\/\/[^\s/]+\.[^\s]+$/.test(v), { error: 'validation.link' });

const ids = z.array(z.uuid()).min(1).max(200);
export const reorderSchema = z.object({ ids });

// ------------------------------------------------------------------ pages

export const cmsPageSchema = z.object({
  title: both(2, 120),
  body: bothMultiline(20, MAX_PAGE_BODY),
  status: z.enum(['published', 'draft']).default('published'),
  seoDescription: z.string().trim().max(300, { error: 'validation.maxLength' }).optional(),
});
export const cmsPageCreateSchema = cmsPageSchema.extend({
  slug: z.string().trim().toLowerCase().min(2).max(80).regex(PAGE_SLUG_PATTERN, { error: 'validation.slug' }),
});
export type CmsPageInput = z.input<typeof cmsPageCreateSchema>;

// ------------------------------------------------------------------ articles

export const articleSchema = z.object({
  kind: z.enum(ARTICLE_KINDS, { error: 'validation.invalidChoice' }),
  title: nfcText(5, 220),
  excerpt: z.string().max(800).transform((v) => v.normalize('NFC').replace(/\s+/g, ' ').trim()).pipe(z.string().max(400, { error: 'validation.maxLength' })).optional(),
  body: multilineText(50, MAX_ARTICLE_BODY),
  language: z.enum(LOCALES),
  audience: z.enum(ARTICLE_AUDIENCES).default('all'),
  tags: z.array(nfcText(2, 30)).max(8).default([]),
  status: z.enum(['draft', 'published']).default('draft'),
});
export type ArticleInput = z.input<typeof articleSchema>;

export const articleListQuerySchema = z.object({
  kind: z.enum(ARTICLE_KINDS).optional(),
  audience: z.enum(ARTICLE_AUDIENCES).optional(),
  q: z.string().trim().max(120).optional(),
  ...page,
});
export const adminArticleQuerySchema = articleListQuerySchema.extend({ status: z.enum(['draft', 'published', 'hidden']).optional() });

// ------------------------------------------------------------------ FAQs

export const faqSchema = z.object({
  category: z.enum(FAQ_CATEGORIES, { error: 'validation.invalidChoice' }),
  question: both(5, 300),
  answer: bothMultiline(10, 5000),
  isPublished: z.boolean().default(true),
});
export type FaqInput = z.input<typeof faqSchema>;

// ------------------------------------------------------------------ banners

/** Sent as the "data" part of a multipart form; the image files travel alongside. */
export const bannerSchema = z
  .object({
    title: both(2, 120),
    subtitle: optionalBoth(200),
    ctaLabel: optionalBoth(40),
    link: siteLinkSchema.optional(),
    placement: z.enum(BANNER_PLACEMENTS).default('home'),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, { error: 'validation.endBeforeStart', path: ['endsAt'] })
  .refine((v) => !v.ctaLabel || !!v.link, { error: 'validation.linkForButton', path: ['link'] });
export type BannerInput = z.input<typeof bannerSchema>;

// ------------------------------------------------------------------ homepage sections

export const sectionConfigSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_SECTION_ITEMS).optional(),
    source: z.enum(BOOK_SOURCES).optional(),
    bookIds: z.array(z.uuid()).max(MAX_MANUAL_BOOKS, { error: 'validation.tooMany' }).optional(),
    categoryId: z.uuid().optional(),
    bannerIds: z.array(z.uuid()).max(10, { error: 'validation.tooMany' }).optional(),
  })
  .refine((c) => c.source !== 'manual' || (c.bookIds?.length ?? 0) > 0, { error: 'validation.pickBooks', path: ['bookIds'] })
  .refine((c) => c.source !== 'category' || !!c.categoryId, { error: 'validation.required', path: ['categoryId'] });
export type SectionConfigInput = z.input<typeof sectionConfigSchema>;

export const sectionUpdateSchema = z.object({
  title: both(2, 120),
  subtitle: optionalBoth(200),
  isEnabled: z.boolean(),
  config: sectionConfigSchema.default({}),
});
export const sectionCreateSchema = sectionUpdateSchema
  .extend({ type: z.enum(HOMEPAGE_SECTION_TYPES.filter((t) => !(SINGLE_SECTION_TYPES as readonly string[]).includes(t)) as [string, ...string[]], { error: 'validation.invalidChoice' }) })
  .refine((v) => v.type !== 'book_list' || !!v.config.source, { error: 'validation.required', path: ['config', 'source'] });
export type SectionCreateInput = z.input<typeof sectionCreateSchema>;

// ------------------------------------------------------------------ testimonials

export const testimonialSchema = z.object({
  name: nfcText(2, 120),
  role: optionalBoth(80),
  quote: both(10, 400),
  /** When the reader agreed to be quoted; required, and never in the future. */
  consentGivenAt: z.coerce.date({ error: 'validation.consentDate' }).refine((d) => d.getTime() <= Date.now() + 60_000, { error: 'validation.consentDate' }),
  isPublished: z.boolean().default(true),
});
export type TestimonialInput = z.input<typeof testimonialSchema>;

// ------------------------------------------------------------------ contact

export const contactMessageSchema = z.object({
  name: nfcText(2, 120),
  email: z.email({ error: 'validation.email' }).max(254).optional().or(z.literal('').transform(() => undefined)),
  phone: bdPhoneSchema.optional().or(z.literal('').transform(() => undefined)),
  topic: z.enum(CONTACT_TOPICS, { error: 'validation.invalidChoice' }),
  orderNumber: z.string().trim().max(40).optional(),
  message: multilineText(20, 3000),
});
export type ContactMessageInput = z.input<typeof contactMessageSchema>;

export const contactMessageQuerySchema = z.object({ status: z.enum(CONTACT_STATUSES).optional(), topic: z.enum(CONTACT_TOPICS).optional(), ...page });
export const contactReplySchema = z.object({ reply: multilineText(5, 5000), close: z.boolean().default(false) });
export const contactStatusSchema = z.object({ status: z.enum(CONTACT_STATUSES) });
