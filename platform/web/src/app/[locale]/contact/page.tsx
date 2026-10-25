import { Clock, Copyright, LifeBuoy } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { alternates } from '@/lib/seo';
import { ContactForm } from './contact-form';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: t('title'), description: t('intro'), alternates: alternates(locale, '/contact') };
}

export default async function ContactPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ topic?: string; order?: string }> }) {
  const { locale } = await params;
  const { topic, order } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
  return (
    <div className="container-page grid max-w-5xl gap-8 py-8 sm:py-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-fg-muted">{t('intro')}</p>
        <ContactForm initialTopic={topic} initialOrder={typeof order === 'string' ? order.slice(0, 40) : undefined} />
      </div>
      <aside className="space-y-3 text-sm lg:pt-14">
        <p className="flex gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
          <Clock className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-fg-muted">{t('replyTime')}</span>
        </p>
        <Link href="/help" className="flex gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm hover:border-primary">
          <LifeBuoy className="h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
          <span>
            <span className="block font-semibold text-fg">{t('helpTitle')}</span>
            <span className="text-fg-muted">{t('helpText')}</span>
          </span>
        </Link>
        <Link href="/copyright" className="flex gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm hover:border-primary">
          <Copyright className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <span>
            <span className="block font-semibold text-fg">{t('copyrightTitle')}</span>
            <span className="text-fg-muted">{t('copyrightText')}</span>
          </span>
        </Link>
      </aside>
    </div>
  );
}
