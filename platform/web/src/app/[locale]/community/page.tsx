import { BookMarked, GraduationCap, Trophy, UsersRound } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { alternates } from '@/lib/seo';
import { CommunityView } from './community-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'community' });
  return { title: t('title'), description: t('intro'), alternates: alternates(locale, '/community') };
}

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const links = [
    { href: '/student-zone', label: t('nav.studentZone'), Icon: GraduationCap },
    { href: '/clubs', label: t('nav.bookClubs'), Icon: UsersRound },
    { href: '/challenges', label: t('nav.challenges'), Icon: Trophy },
    { href: '/account/saved', label: t('community.savedPosts'), Icon: BookMarked },
  ];
  return (
    <div className="container-page grid gap-8 py-6 lg:grid-cols-[1fr_300px] lg:py-8">
      <div className="min-w-0 max-w-2xl space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('community.title')}</h1>
          <p className="mt-1 text-fg-muted">{t('community.intro')}</p>
        </header>
        <CommunityView />
      </div>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <nav aria-label={t('community.explore')} className="rounded-xl border border-line bg-surface p-2 shadow-sm">
          <ul>
            {links.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link href={href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-fg hover:bg-subtle">
                  <Icon className="h-5 w-5 text-secondary" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="guidelines" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 id="guidelines" className="font-bold text-fg">
            {t('community.guidelinesTitle')}
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
            {(['respect', 'spoilers', 'copyright', 'privacy', 'noSpam'] as const).map((k) => (
              <li key={k}>{t(`community.guidelines.${k}`)}</li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
