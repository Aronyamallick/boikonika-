import type { BookCardData, ProductCardData } from '@/lib/catalog';

/** Digital editions, previews, downloads and wishlist — response shapes mirror the API. */

export type EbookFormat = 'pdf' | 'epub';
export type AssetStatus = 'active' | 'withdrawn' | 'replaced' | 'removed';

export interface DownloadLink {
  url: string;
  expiresAt: string;
  fileName: string;
  format: EbookFormat;
  sizeBytes: number;
  remainingToday: number;
}

export interface DownloadEntry {
  id: string;
  at: string;
  fileName: string;
  format: EbookFormat;
  sizeBytes: number;
  available: boolean;
  book: { id: string; slug: string; title: string; coverUrl: string | null };
}

export interface HistoryEntry {
  id: string;
  event: 'started' | 'finished' | 'downloaded' | string;
  at: string;
  book: { id: string; slug: string; title: string; coverUrl: string | null };
}

export interface StudioPreview {
  id: string;
  kind: 'pdf' | 'sample_chapter' | 'sample_pages';
  title: string | null;
  previewPercent: number;
  pages: number;
  chars: number;
  samplePages: number | null;
}

export interface StudioEdition {
  book: { id: string; slug: string; title: string; coverUrl: string | null };
  capacities: Array<'author' | 'publisher'>;
  asset: { id: string; fileName: string; format: EbookFormat; sizeBytes: number; pageCount: number | null; status: AssetStatus; removedReason: string | null; uploadedAt: string } | null;
  offer: { mode: 'free' } | { mode: 'paid'; price: string; compareAtPrice: string | null; status: string; productSlug: string } | null;
  lastPrice: string | null;
  onSale: boolean;
  offeredByOther: boolean;
  sales: number;
  downloads: number;
  readers: number;
  previews: StudioPreview[];
}

export interface StudioData {
  editions: StudioEdition[];
  canSell: boolean;
  previewMaxPercent: number;
}

export interface BookPreviewData {
  book: { id: string; slug: string; title: string; subtitle: string | null; coverUrl: string | null; description: string | null; authors: string[]; tableOfContents: Array<{ title: string; page?: number }> | null };
  digital: { format: EbookFormat; pageCount: number | null; sizeBytes: number; isFree: boolean } | null;
  previews: Array<{ id: string; kind: 'pdf' | 'sample_chapter' | 'sample_pages'; title: string | null; content: string | null; pages: string[]; pdfUrl: string | null; samplePages: number | null; previewPercent: number }>;
}

export interface AdminDigitalFile {
  id: string;
  fileName: string;
  format: EbookFormat;
  sizeBytes: number;
  pageCount: number | null;
  status: AssetStatus;
  removedReason: string | null;
  uploadedAt: string;
  sha256: string;
  downloads: number;
  uploader: { name: string; username: string | null } | null;
  declaration: { capacity: string; statement: string; at: string } | null;
  book: { id: string; slug: string; title: string; coverUrl: string | null };
}

export interface WishlistData {
  books: Array<BookCardData & { savedAt: string }>;
  products: Array<ProductCardData & { available: boolean; savedAt: string }>;
}

/** "2.4 MB" in the reader's locale. */
export function formatBytes(bytes: number, locale: string): string {
  const mb = bytes / (1024 * 1024);
  const nf = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en', { maximumFractionDigits: mb < 10 ? 1 : 0 });
  return mb >= 1 ? `${nf.format(mb)} MB` : `${nf.format(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

/** Hands the browser a fresh signed link so it saves the file (links expire within minutes). */
export function saveFrom(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
