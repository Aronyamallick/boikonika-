export type { EbookFormat, AssetStatus, DownloadLink, DownloadEntry, HistoryEntry, StudioPreview, StudioEdition, StudioData, BookPreviewData, AdminDigitalFile, WishlistData } from '@boikonika/shared';

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
