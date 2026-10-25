import { localizeDigits } from '@boikonika/shared';
import { ArrowLeft, BookOpenText, ExternalLink, FileText, Tablet } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { BookCover } from '@/components/ui/book-cover';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { serverApi } from '@/lib/api/server';
import type { BookPreviewData } from '@/lib/digital';
import { formatBytes } from '@/lib/digital';
import { alternates } from '@/lib/seo';

type Params = Promise<{ locale: string; slug: string }>;

// Sample files are reached through short-lived links, so this page is always rendered fresh.
const load = (locale: string, slug: string) => (slug.length > 220 ? null : serverApi<BookPreviewData>(`/books/${encodeURIComponent(decodeURIComponent(slug))}/preview`, { locale, revalidate: false }));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const data = await load(locale, slug);
  if (!data) return { title: '404', robots: { index: false } };
  const t = await getTranslations({ locale, namespace: 'digital' });
  return { title: t('lookInsideTitle', { title: data.book.title }), alternates: alternates(locale, `/books/${data.book.slug}/preview`) };
}

/** Plain-text sample: blank lines separate paragraphs. */
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </>
  );
}

export default async function BookPreviewPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const data = await load(locale, slug);
  if (!data) notFound();
  const t = await getTranslations();
  const { book, digital, previews } = data;
  const toc = book.tableOfContents ?? [];

  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: t('catalog.booksTitle'), href: '/books' }, { label: book.title, href: `/books/${book.slug}` }, { label: t('digital.lookInside') }]} />

      <header className="mt-6 flex flex-wrap items-start gap-5">
        <div className="w-24 shrink-0 sm:w-28">
          <BookCover src={book.coverUrl} title={book.title} author={book.authors.join(', ')} sizes="7rem" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
            <BookOpenText className="h-4 w-4" aria-hidden="true" />
            {t('digital.lookInside')}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight text-fg sm:text-3xl">{book.title}</h1>
          {book.subtitle ? <p className="mt-1 text-fg-muted">{book.subtitle}</p> : null}
          {book.authors.length ? <p className="mt-1 text-fg-muted">{book.authors.join(', ')}</p> : null}
          {digital ? (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
              <Tablet className="h-4 w-4 text-secondary" aria-hidden="true" />
              {[t('digital.ebook'), digital.format.toUpperCase(), digital.pageCount ? t('digital.pages', { count: digital.pageCount }) : null, formatBytes(digital.sizeBytes, locale), digital.isFree ? t('digital.free') : null].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          <Link href={`/books/${book.slug}`} className={buttonClasses({ variant: 'outline', size: 'sm', className: 'mt-4' })}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('digital.backToBook')}
          </Link>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-8">
          {previews.length === 0 && !book.description ? (
            <EmptyState icon={<BookOpenText className="h-6 w-6" />} title={t('digital.noPreview')} text={t('digital.noPreviewText')} />
          ) : null}

          {previews.map((p) =>
            p.kind === 'pdf' && p.pdfUrl ? (
              <section key={p.id} aria-labelledby={`pv-${p.id}`} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id={`pv-${p.id}`} className="flex items-center gap-2 text-lg font-bold text-fg">
                      <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                      {t('digital.samplePdf')}
                    </h2>
                    {p.samplePages ? <p className="mt-1 text-sm text-fg-muted">{t('digital.samplePdfText', { count: p.samplePages, percent: p.previewPercent })}</p> : null}
                  </div>
                  <a href={p.pdfUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: 'sm' })}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    {t('digital.openSample')}
                  </a>
                </div>
              </section>
            ) : p.kind === 'sample_chapter' && p.content ? (
              <article key={p.id} aria-labelledby={`pv-${p.id}`} className="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-8">
                <p className="text-xs font-bold uppercase tracking-wide text-fg-subtle">{t('digital.sampleChapter')}</p>
                <h2 id={`pv-${p.id}`} className="mt-1 text-xl font-bold text-fg">
                  {p.title}
                </h2>
                <div className="mt-4 max-w-prose space-y-4 text-[17px] leading-8 text-fg">
                  <Paragraphs text={p.content} />
                </div>
              </article>
            ) : p.kind === 'sample_pages' && p.pages.length ? (
              <section key={p.id} aria-labelledby={`pv-${p.id}`}>
                <h2 id={`pv-${p.id}`} className="text-lg font-bold text-fg">
                  {p.title ?? t('digital.samplePages')}
                </h2>
                <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                  {p.pages.map((url, i) => (
                    <li key={url} className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element -- sample pages come through short-lived signed links */}
                      <img src={url} alt={t('digital.samplePageAlt', { page: i + 1, title: book.title })} loading="lazy" className="h-auto w-full" />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}

          {book.description && !previews.some((p) => p.kind === 'sample_chapter') ? (
            <section aria-labelledby="pv-about">
              <h2 id="pv-about" className="text-lg font-bold text-fg">
                {t('book.description')}
              </h2>
              <div className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-fg">{book.description}</div>
            </section>
          ) : null}
        </div>

        <aside aria-labelledby="pv-contents" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <h2 id="pv-contents" className="font-bold text-fg">
              {t('digital.contents')}
            </h2>
            {toc.length ? (
              <ol className="mt-3 space-y-2 text-sm">
                {toc.map((c, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-fg">{c.title}</span>
                    {c.page ? <span className="shrink-0 text-fg-muted">{localizeDigits(c.page, locale)}</span> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-fg-muted">{t('digital.noContents')}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
