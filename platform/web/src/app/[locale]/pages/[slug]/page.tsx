import { markdownToText } from '@boikonika/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { headings, Markdown } from '@/components/content/markdown';
import { Link } from '@/i18n/navigation';
import { serverApi } from '@/lib/api/server';
import { localized } from '@/lib/catalog';
import { POLICY_PAGES, type CmsPage } from '@/lib/content';
import { alternates } from '@/lib/seo';

type Params = { params: Promise<{ locale: string; slug: string }> };
const load = (slug: string, locale: string) => serverApi<CmsPage>(`/pages/${encodeURIComponent(slug)}`, { locale, revalidate: 60 });

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await load(slug, locale);
  if (!page) return {};
  return { title: localized(page.title, locale), description: page.seoDescription || markdownToText(localized(page.body, locale), 160), alternates: alternates(locale, `/pages/${page.slug}`) };
}

/** Information pages (about, terms, privacy, policies) written by staff in both languages. */
export default async function InfoPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = await load(slug, locale);
  if (!page) notFound();
  const t = await getTranslations('content');
  const format = await getFormatter();
  const title = localized(page.title, locale);
  const body = localized(page.body, locale);
  const toc = headings(body);
  const isPolicy = (POLICY_PAGES as readonly string[]).includes(page.slug);
  const others = isPolicy ? ((await serverApi<Array<{ slug: string; title: CmsPage['title'] }>>('/pages', { locale, revalidate: 60 }).catch(() => null)) ?? []).filter((p) => p.slug !== page.slug && (POLICY_PAGES as readonly string[]).includes(p.slug)) : [];

  return (
    <div className="container-page py-6 sm:py-10">
      <Breadcrumbs items={[{ label: title }]} />
      <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_16rem]">
        <article className="min-w-0 max-w-3xl">
          <header className="mb-6 border-b border-line pb-5">
            <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{title}</h1>
            <p className="mt-2 text-sm text-fg-subtle">{t('updated', { date: format.dateTime(new Date(page.updatedAt), { dateStyle: 'long' }) })}</p>
          </header>
          {toc.length > 2 ? (
            // Phones get the contents up front, folded; wide screens have them in the side column.
            <details className="mb-6 rounded-xl border border-line bg-surface p-4 text-sm shadow-sm lg:hidden">
              <summary className="cursor-pointer font-bold text-fg">{t('onThisPage')}</summary>
              <ol className="mt-2 space-y-1.5">
                {toc.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="text-fg-muted hover:text-primary">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
          <Markdown source={body} />
        </article>
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {toc.length > 2 ? (
            <nav aria-labelledby="toc-title" className="hidden rounded-xl border border-line bg-surface p-4 text-sm shadow-sm lg:block">
              <h2 id="toc-title" className="mb-2 font-bold text-fg">
                {t('onThisPage')}
              </h2>
              <ol className="space-y-1.5">
                {toc.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="text-fg-muted hover:text-primary">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          {others.length ? (
            <nav aria-labelledby="policies-title" className="text-sm">
              <h2 id="policies-title" className="mb-2 font-bold text-fg">
                {t('otherPolicies')}
              </h2>
              <ul className="space-y-1.5">
                {others.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/pages/${p.slug}`} className="text-fg-muted hover:text-primary">
                      {localized(p.title, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <p className="rounded-xl bg-subtle p-4 text-sm text-fg-muted">
            {t('questions')}{' '}
            <Link href="/contact" className="font-semibold text-primary hover:underline">
              {t('contactUs')}
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
