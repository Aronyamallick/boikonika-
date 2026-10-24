import { BadgeCheck, BookOpenCheck, Brain, GraduationCap, HandCoins, PenLine, Share2, ShoppingBag, Sparkles, Trophy, Users } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SearchBox } from '@/components/layout/search-box';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const journey = [
    { Icon: ShoppingBag, label: t('common.philosophy').split('·')[0]?.trim() },
    { Icon: Sparkles, label: t('common.philosophy').split('·')[1]?.trim() },
    { Icon: BookOpenCheck, label: t('common.philosophy').split('·')[2]?.trim() },
    { Icon: Brain, label: t('common.philosophy').split('·')[3]?.trim() },
    { Icon: PenLine, label: t('common.philosophy').split('·')[4]?.trim() },
    { Icon: Share2, label: t('common.philosophy').split('·')[5]?.trim() },
  ];
  const features = [
    { href: '/student-zone', Icon: GraduationCap, title: t('landing.studentZoneTitle'), text: t('landing.studentZoneText'), tone: 'bg-secondary-soft text-secondary-soft-fg' },
    { href: '/challenges', Icon: Trophy, title: t('landing.challengeTitle'), text: t('landing.challengeText'), tone: 'bg-accent-soft text-accent-soft-fg' },
    { href: '/clubs', Icon: Users, title: t('landing.clubsTitle'), text: t('landing.clubsText'), tone: 'bg-primary-soft text-primary-soft-fg' },
  ];
  const reasons = [
    { Icon: BadgeCheck, title: t('landing.why1Title'), text: t('landing.why1Text') },
    { Icon: HandCoins, title: t('landing.why2Title'), text: t('landing.why2Text') },
    { Icon: BookOpenCheck, title: t('landing.why3Title'), text: t('landing.why3Text') },
    { Icon: GraduationCap, title: t('landing.why4Title'), text: t('landing.why4Text') },
  ];

  return (
    <>
      <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line bg-surface">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,var(--bk-primary-soft),transparent),radial-gradient(40rem_24rem_at_0%_110%,var(--bk-secondary-soft),transparent)]" />
        <div className="container-page relative py-16 sm:py-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-soft-fg">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t('common.tagline')}
          </p>
          <h1 id="hero-title" className="max-w-3xl text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
            {t('landing.heroTitle')}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-fg-muted">{t('landing.heroSubtitle')}</p>
          <div className="mt-8 max-w-2xl">
            <SearchBox action="/search" size="lg" />
          </div>
          <ol className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-fg-muted" aria-label={t('common.philosophy')}>
            {journey.map(({ Icon, label }, i) => (
              <li key={i} className="inline-flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-primary shadow-sm ring-1 ring-line">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {label}
                {i < journey.length - 1 ? <span aria-hidden="true" className="text-fg-subtle">→</span> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-label={t('landing.educationalTitle')} className="container-page py-14">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map(({ href, Icon, title, text, tone }) => (
            <Link key={href} href={href} className="group rounded-2xl border border-line bg-surface p-6 shadow-sm transition-shadow hover:shadow-md">
              <span className={`inline-flex rounded-xl p-3 ${tone}`} aria-hidden="true">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-fg group-hover:text-primary">{title}</h2>
              <p className="mt-1.5 text-sm text-fg-muted">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="why-title" className="border-y border-line bg-surface">
        <div className="container-page py-14">
          <h2 id="why-title" className="text-2xl font-bold sm:text-3xl">
            {t('landing.whyTitle')}
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {reasons.map(({ Icon, title, text }) => (
              <li key={title} className="space-y-2">
                <Icon className="h-7 w-7 text-secondary" aria-hidden="true" />
                <h3 className="font-bold text-fg">{title}</h3>
                <p className="text-sm text-fg-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page grid gap-5 py-14 md:grid-cols-2">
        <div className="rounded-2xl bg-primary p-8 text-primary-fg shadow-md dark:bg-primary-soft dark:text-primary-soft-fg dark:ring-1 dark:ring-primary/30">
          <h2 className="text-2xl font-bold">{t('landing.ctaTitle')}</h2>
          <p className="mt-2 opacity-90">{t('landing.ctaText')}</p>
          <Link href="/register" className={buttonClasses({ variant: 'accent', className: 'mt-6' })}>
            {t('common.getStarted')}
          </Link>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <h2 className="text-2xl font-bold">{t('landing.sellCtaTitle')}</h2>
          <p className="mt-2 text-fg-muted">{t('landing.sellCtaText')}</p>
          <Link href="/sell" className={buttonClasses({ variant: 'secondary', className: 'mt-6' })}>
            {t('nav.sell')}
          </Link>
        </div>
      </section>
    </>
  );
}
