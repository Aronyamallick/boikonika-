import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CopyrightForm } from './copyright-form';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'copyrightForm' });
  return { title: t('title'), description: t('intro'), alternates: { canonical: `/${locale}/copyright`, languages: { bn: '/bn/copyright', en: '/en/copyright' } } };
}

/** Public takedown form for rights holders; explains the process before asking for anything. */
export default async function CopyrightPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ url?: string }> }) {
  const { locale } = await params;
  const { url } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('copyrightForm');
  const steps = ['submit', 'review', 'decision', 'counter'] as const;
  return (
    <div className="container-page grid max-w-5xl gap-8 py-8 sm:py-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('title')}</h1>
        <p className="mt-2 text-fg-muted">{t('intro')}</p>
        <CopyrightForm initialUrl={typeof url === 'string' ? url.slice(0, 500) : ''} />
      </div>
      <aside className="space-y-4 lg:pt-14">
        <section aria-labelledby="cr-how" className="rounded-xl border border-line bg-surface p-5 text-sm shadow-sm">
          <h2 id="cr-how" className="mb-3 font-bold">
            {t('howTitle')}
          </h2>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-fg" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="text-fg-muted">{t(`steps.${s}`)}</span>
              </li>
            ))}
          </ol>
        </section>
        <p className="rounded-xl bg-warning-soft p-4 text-sm text-warning-soft-fg">{t('warning')}</p>
      </aside>
    </div>
  );
}
