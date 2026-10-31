import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { alternates } from '@/lib/seo';
import { AssistantView } from './assistant-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'assistant' });
  return { title: t('title'), description: t('intro'), alternates: alternates(locale, '/assistant') };
}

export default async function AssistantPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ book?: string; task?: string }> }) {
  const { locale } = await params;
  const { book, task } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('assistant');
  return (
    <div className="container-page max-w-5xl py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-fg-muted">{t('intro')}</p>
      </header>
      <AssistantView initialBook={typeof book === 'string' ? book.slice(0, 200) : undefined} initialTask={typeof task === 'string' ? task : undefined} />
    </div>
  );
}
