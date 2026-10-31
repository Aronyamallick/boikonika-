/** E-books and previews (kept apart from zod so browser bundles stay small). */

/** Largest e-book file a rights holder can upload. */
export const DIGITAL_FILE_MAX_MB = 50;
export const DIGITAL_FILE_TYPES = ['application/pdf', 'application/epub+zip'] as const;
export type DigitalFileType = (typeof DIGITAL_FILE_TYPES)[number];

/** Who may publish a digital edition: the rights holder or someone licensed by them (never a reseller). */
export const DIGITAL_CAPACITIES = ['author', 'publisher', 'licensed_distributor'] as const;
export type DigitalCapacity = (typeof DIGITAL_CAPACITIES)[number];

export const DIGITAL_ASSET_STATUSES = ['active', 'withdrawn', 'replaced', 'removed'] as const;
export type DigitalAssetStatus = (typeof DIGITAL_ASSET_STATUSES)[number];

/** Default share of a PDF shown as a free sample; staff set the ceiling (`preview.maxPercent`, at most 50). */
export const DEFAULT_PREVIEW_PERCENT = 10;
export const PREVIEW_PERCENT_CEILING = 50;
export const MAX_SAMPLE_CHAPTER_CHARS = 40_000;
export const MAX_SAMPLE_PAGES = 12;
export const MAX_PREVIEWS_PER_BOOK = 20;

/** Signed download links live this long (seconds). */
export const DOWNLOAD_LINK_TTL = 300;
