import { FAQ_CATEGORIES } from '@boikonika/shared';
import { Copyright, LifeBuoy, MessageCircle, Package, RotateCcw, ShieldCheck, Store } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/catalog/json-ld';
import { Markdown } from '@/components/content/markdown';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { serverApi, serverPage } from '@/lib/api/server';
import { localized } from '@/lib/catalog';
import type { ArticleCard, Faq } from '@/lib/content';
import { alternates } from '@/lib/seo';
import { HelpSearch } from './help-search';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'help' });
  return { title: t('title'), description: t('intro'), alternates: alternates(locale, '/help') };
}

/** Help centre: search, common tasks, help articles and every FAQ grouped by topic. */
export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('help');
  const [faqs, articles] = await Promise.all([
    serverApi<Faq[]>('/faqs', { locale, revalidate: 60 }).catch(() => null),
    serverPage<ArticleCard>('/articles?kind=help&pageSize=50', { locale, revalidate: 60 }).catch(() => ({ items: [] as ArticleCard[] })),
  ]);
  const groups = FAQ_CATEGORIES.map((c) => ({ category: c, items: (faqs ?? []).filter((f) => f.category === c) })).filter((g) => g.items.length);
  const shortcuts = [
    { href: '/account/orders', Icon: Package, label: t('shortcuts.orders') },
    { href: '/pages/return-policy', Icon: RotateCcw, label: t('shortcuts.returns') },
    { href: '/seller', Icon: Store, label: t('shortcuts.sell') },
    { href: '/account/security', Icon: ShieldCheck, label: t('shortcuts.security') },
    { href: '/copyright', Icon: Copyright, label: t('shortcuts.copyright') },
    { href: '/contact', Icon: MessageCircle, label: t('shortcuts.contact') },
  ];

  return (
    <>
      {faqs?.length ? (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            inLanguage: locale,
            mainEntity: faqs.map((f) => ({ '@type': 'Question', name: localized(f.question, locale), acceptedAnswer: { '@type': 'Answer', text: localized(f.answer, locale) } })),
          }}
        />
      ) : null}
      <section className="border-b border-line bg-surface">
        <div className="container-page py-10 sm:py-14">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary-soft px-3 py-1 text-sm font-semibold text-secondary-soft-fg">
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            {t('eyebrow')}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-fg-muted">{t('intro')}</p>
          <div className="mt-6 max-w-2xl">
            <HelpSearch />
          </div>
        </div>
      </section>

      <div className="container-page space-y-10 py-8 sm:py-10">
        <nav aria-labelledby="shortcuts-title">
          <h2 id="shortcuts-title" className="sr-only">
            {t('shortcutsTitle')}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {shortcuts.map(({ href, Icon, label }) => (
              <li key={href}>
                <Link href={href} className="flex h-full flex-col items-start gap-2 rounded-xl border border-line bg-surface p-4 text-sm font-semibold text-fg shadow-sm transition-colors hover:border-primary hover:text-primary">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {articles.items.length ? (
          <section aria-labelledby="guides-title">
            <h2 id="guides-title" className="mb-3 text-xl font-bold">
              {t('guidesTitle')}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {articles.items.map((a) => (
                <li key={a.id}>
                  <Link href={`/help/${a.slug}`} className="block h-full rounded-xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-primary" lang={a.language}>
                    <span className="block font-semibold text-fg">{a.title}</span>
                    <span className="mt-1 line-clamp-2 block text-sm text-fg-muted">{a.excerpt}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="faq-title" className="grid gap-8 lg:grid-cols-[14rem_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2 id="faq-title" className="text-xl font-bold">
              {t('faqTitle')}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {groups.map((g) => (
                <li key={g.category}>
                  <a href={`#faq-${g.category}`} className="inline-block rounded-full bg-subtle px-3 py-1.5 text-sm font-semibold text-fg-muted hover:text-fg lg:rounded-lg lg:bg-transparent lg:px-0 lg:py-1">
                    {t(`categories.${g.category}`)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 space-y-8">
            {groups.map((g) => (
              <div key={g.category} id={`faq-${g.category}`} className="scroll-mt-24">
                <h3 className="mb-3 text-lg font-bold text-fg">{t(`categories.${g.category}`)}</h3>
                <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
                  {g.items.map((f) => (
                    <details key={f.id} id={`q-${f.id}`} className="group scroll-mt-24">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5 font-semibold text-fg hover:bg-subtle [&::-webkit-details-marker]:hidden">
                        {localized(f.question, locale)}
                        <span aria-hidden="true" className="mt-0.5 text-fg-subtle transition-transform group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <div className="px-4 pb-4">
                        <Markdown source={localized(f.answer, locale)} compact className="text-fg-muted" />
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-start gap-3 rounded-2xl bg-primary-soft p-6 text-primary-soft-fg sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">{t('stillStuck')}</h2>
            <p className="text-sm">{t('stillStuckText')}</p>
          </div>
          <Link href="/contact" className={buttonClasses({ className: 'shrink-0' })}>
            {t('shortcuts.contact')}
          </Link>
        </section>
      </div>
    </>
  );
}
