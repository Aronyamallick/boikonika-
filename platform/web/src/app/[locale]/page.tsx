import { BadgeCheck, BookOpenCheck, Brain, CalendarDays, GraduationCap, HandCoins, PenLine, Quote, Share2, ShoppingBag, Sparkles, Trophy, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookCard } from '@/components/catalog/book-card';
import { CategoryIcon } from '@/components/catalog/category-icon';
import { JsonLd } from '@/components/catalog/json-ld';
import { AuthorCard, StoreCard } from '@/components/catalog/people-cards';
import { ClubCard } from '@/components/clubs/club-card';
import { ArticleCard } from '@/components/content/article-card';
import { BannerStrip } from '@/components/content/banner-strip';
import { Shelf } from '@/components/catalog/shelf';
import { ForYou } from '@/components/recommendations/for-you';
import { SearchBox } from '@/components/layout/search-box';
import { Avatar } from '@/components/ui/avatar';
import { buttonClasses } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Link } from '@/i18n/navigation';
import { serverApi } from '@/lib/api/server';
import { localized, type AuthorCardData, type BookCardData, type HomeSection, type LocalizedText, type StoreCardData } from '@/lib/catalog';
import type { ClubCard as Club } from '@/lib/clubs';
import type { ArticleCard as ArticleCardData, Banner, Testimonial } from '@/lib/content';
import { SITE_URL } from '@/lib/env';
import { alternates, localePath } from '@/lib/seo';

/** Where "View all" goes for each kind of book shelf. */
const SHELF_LINKS: Record<string, string> = {
  trending: '/books?sort=popular',
  best_sellers: '/books?sort=popular',
  new_releases: '/books?sort=newest',
  editors_picks: '/books?pick=editors',
  student_picks: '/books?pick=students',
  teacher_picks: '/books?pick=teachers',
  discounted: '/books?discounted=1',
  used: '/books?condition=used_like_new,used_good,used_acceptable',
  free: '/books?free=1',
  hidden_gems: '/books?minRating=4',
};

type CategoryItem = { slug: string; path: string; name: LocalizedText; icon: string | null };
type ChallengeItem = { slug: string; title: LocalizedText; description: LocalizedText; target: number; durationDays: number; xpReward: number; participantCount: number };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: { absolute: `${t('common.appName')} — ${t('common.tagline')}` }, description: t('landing.heroSubtitle'), alternates: alternates(locale, '/') };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  // The homepage still renders its static parts if the catalogue is briefly unreachable.
  const sections = (await serverApi<HomeSection[]>('/home', { locale, revalidate: 60 }).catch(() => null)) ?? [];

  const render = (s: HomeSection, index: number) => {
    const title = localized(s.title, locale);
    const subtitle = localized(s.subtitle, locale) || undefined;
    const id = `home-${s.key}`;
    switch (s.type) {
      case 'hero':
        return <Hero key={s.key} title={title || t('landing.heroTitle')} subtitle={subtitle ?? t('landing.heroSubtitle')} />;
      case 'book_list': {
        const books = s.items as BookCardData[];
        return (
          <Shelf key={s.key} id={id} title={title} subtitle={subtitle} href={s.config.source ? SHELF_LINKS[s.config.source] : undefined} linkLabel={t('common.viewAll')}>
            {books.map((b, i) => (
              <BookCard key={b.id} book={b} priority={index < 3 && i < 4} />
            ))}
          </Shelf>
        );
      }
      case 'category_grid':
        return (
          <section key={s.key} aria-labelledby={id} className="container-page py-6">
            <SectionHeader id={id} title={title} description={subtitle} href="/books" linkLabel={t('common.viewAll')} />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(s.items as CategoryItem[]).map((c) => (
                <li key={c.path}>
                  <Link href={`/categories/${c.path}`} className="flex h-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-sm font-semibold text-fg shadow-sm transition-colors hover:border-primary hover:text-primary">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                      <CategoryIcon name={c.icon} className="h-5 w-5" />
                    </span>
                    <span className="line-clamp-2">{localized(c.name, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      case 'author_list':
        return (
          <Shelf key={s.key} id={id} title={title} subtitle={subtitle} href="/authors" linkLabel={t('common.viewAll')} itemClassName="w-32 sm:w-36">
            {(s.items as AuthorCardData[]).map((a) => (
              <AuthorCard key={a.slug} author={a} />
            ))}
          </Shelf>
        );
      case 'featured_sellers':
        return (
          <section key={s.key} aria-labelledby={id} className="container-page py-6">
            <SectionHeader id={id} title={title} description={subtitle} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(s.items as StoreCardData[]).map((store) => (
                <li key={store.slug} className="flex">
                  <StoreCard store={store} />
                </li>
              ))}
            </ul>
          </section>
        );
      case 'reading_challenges':
        return (
          <section key={s.key} aria-labelledby={id} className="container-page py-6">
            <SectionHeader id={id} title={title} description={subtitle ?? t('landing.challengeText')} href="/challenges" linkLabel={t('common.viewAll')} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(s.items as ChallengeItem[]).map((c) => (
                <li key={c.slug} className="group relative flex flex-col rounded-xl border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-fg" aria-hidden="true">
                    <Trophy className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-bold text-fg">
                    <Link href={`/challenges/${c.slug}`} className="after:absolute after:inset-0 after:rounded-xl group-focus-within:underline">
                      {localized(c.title, locale)}
                    </Link>
                  </h3>
                  <p className="mt-1 flex-1 text-sm text-fg-muted">{localized(c.description, locale)}</p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-fg-subtle">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('landing.challengeDays', { days: c.durationDays })} · {t('landing.challengeXp', { xp: c.xpReward })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      case 'student_zone':
        return (
          <section key={s.key} aria-labelledby={id} className="container-page py-6">
            <div className="grid gap-5 md:grid-cols-3">
              {[
                { href: '/student-zone', Icon: GraduationCap, title: title || t('landing.studentZoneTitle'), text: subtitle ?? t('landing.studentZoneText'), tone: 'bg-secondary-soft text-secondary-soft-fg', id },
                { href: '/challenges', Icon: Trophy, title: t('landing.challengeTitle'), text: t('landing.challengeText'), tone: 'bg-accent-soft text-accent-soft-fg' },
                { href: '/clubs', Icon: Users, title: t('landing.clubsTitle'), text: t('landing.clubsText'), tone: 'bg-primary-soft text-primary-soft-fg' },
              ].map(({ href, Icon, title: cardTitle, text, tone, id: headingId }) => (
                <Link key={href} href={href} className="group rounded-2xl border border-line bg-surface p-6 shadow-sm transition-shadow hover:shadow-md">
                  <span className={`inline-flex rounded-xl p-3 ${tone}`} aria-hidden="true">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h2 id={headingId} className="mt-4 text-lg font-bold text-fg group-hover:text-primary">
                    {cardTitle}
                  </h2>
                  <p className="mt-1.5 text-sm text-fg-muted">{text}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      case 'banner':
        return (
          <section key={s.key} aria-labelledby={id} className="py-4">
            <h2 id={id} className="sr-only">
              {title}
            </h2>
            <BannerStrip banners={s.items as Banner[]} locale={locale} label={title} priority={index < 2} />
          </section>
        );
      case 'book_clubs':
        return (
          <section key={s.key} aria-labelledby={id} className="container-page py-6">
            <SectionHeader id={id} title={title} description={subtitle} href="/clubs" linkLabel={t('common.viewAll')} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(s.items as Club[]).map((c) => (
                <li key={c.id}>
                  <ClubCard club={c} />
                </li>
              ))}
            </ul>
          </section>
        );
      case 'articles':
        return (
          <section key={s.key} aria-labelledby={id} className="container-page py-6">
            <SectionHeader id={id} title={title} description={subtitle} href="/blog" linkLabel={t('common.viewAll')} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(s.items as ArticleCardData[]).map((a) => (
                <li key={a.id}>
                  <ArticleCard article={a} />
                </li>
              ))}
            </ul>
          </section>
        );
      case 'testimonials':
        return (
          <section key={s.key} aria-labelledby={id} className="container-page py-6">
            <SectionHeader id={id} title={title} description={subtitle} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(s.items as Testimonial[]).map((q) => (
                <li key={q.id}>
                  <figure className="flex h-full flex-col rounded-xl border border-line bg-surface p-5 shadow-sm">
                    <Quote className="h-6 w-6 text-accent" aria-hidden="true" />
                    <blockquote className="mt-2 flex-1 text-fg">{localized(q.quote, locale)}</blockquote>
                    <figcaption className="mt-4 flex items-center gap-3 text-sm">
                      <Avatar name={q.name} src={q.avatarUrl} size="sm" />
                      <span>
                        <span className="block font-semibold text-fg">{q.name}</span>
                        {localized(q.role, locale) ? <span className="block text-fg-muted">{localized(q.role, locale)}</span> : null}
                      </span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </section>
        );
      case 'why_choose_us':
        return <WhyUs key={s.key} title={title || t('landing.whyTitle')} />;
      default:
        return null;
    }
  };

  const hasHero = sections.some((s) => s.type === 'hero');
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: t('common.appName'),
          url: `${SITE_URL}${localePath(locale, '/')}`,
          inLanguage: locale,
          potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}${localePath(locale, '/search')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
        }}
      />
      {hasHero ? null : <Hero title={t('landing.heroTitle')} subtitle={t('landing.heroSubtitle')} />}
      <div className="space-y-2 py-4">
        {hasHero ? null : <ForYou />}
        {sections.map((s, i) => (s.type === 'hero' ? [render(s, i), <ForYou key="for-you" />] : render(s, i)))}
      </div>
      {sections.some((s) => s.type === 'why_choose_us') ? null : <WhyUs title={t('landing.whyTitle')} />}

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
          <Link href="/seller" className={buttonClasses({ variant: 'secondary', className: 'mt-6' })}>
            {t('nav.sell')}
          </Link>
        </div>
      </section>
    </>
  );
}

async function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  const t = await getTranslations();
  const steps = t('common.philosophy').split('·').map((s) => s.trim());
  const icons = [ShoppingBag, Sparkles, BookOpenCheck, Brain, PenLine, Share2];
  return (
    <section aria-labelledby="hero-title" className="relative -mt-4 overflow-hidden border-b border-line bg-surface">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,var(--bk-primary-soft),transparent),radial-gradient(40rem_24rem_at_0%_110%,var(--bk-secondary-soft),transparent)]" />
      <div className="container-page relative py-14 sm:py-20">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-soft-fg">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {t('common.tagline')}
        </p>
        <h1 id="hero-title" className="max-w-3xl text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-fg-muted">{subtitle}</p>
        <div className="mt-8 max-w-2xl">
          <SearchBox action="/search" size="lg" />
        </div>
        <ol className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-fg-muted" aria-label={t('common.philosophy')}>
          {steps.map((label, i) => {
            const Icon = icons[i] ?? Sparkles;
            return (
              <li key={label} className="inline-flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-primary shadow-sm ring-1 ring-line">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {label}
                {i < steps.length - 1 ? (
                  <span aria-hidden="true" className="text-fg-subtle">
                    →
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

async function WhyUs({ title }: { title: string }) {
  const t = await getTranslations();
  const reasons = [
    { Icon: BadgeCheck, title: t('landing.why1Title'), text: t('landing.why1Text') },
    { Icon: HandCoins, title: t('landing.why2Title'), text: t('landing.why2Text') },
    { Icon: BookOpenCheck, title: t('landing.why3Title'), text: t('landing.why3Text') },
    { Icon: GraduationCap, title: t('landing.why4Title'), text: t('landing.why4Text') },
  ];
  return (
    <section aria-labelledby="why-title" className="my-8 border-y border-line bg-surface">
      <div className="container-page py-14">
        <h2 id="why-title" className="text-2xl font-bold sm:text-3xl">
          {title}
        </h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map(({ Icon, title: reason, text }) => (
            <li key={reason} className="space-y-2">
              <Icon className="h-7 w-7 text-secondary" aria-hidden="true" />
              <h3 className="font-bold text-fg">{reason}</h3>
              <p className="text-sm text-fg-muted">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
