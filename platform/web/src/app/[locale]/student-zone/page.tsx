import { CalendarDays, ExternalLink, GraduationCap, NotebookPen, Sparkles, Trophy, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { BookCard } from '@/components/catalog/book-card';
import { Shelf } from '@/components/catalog/shelf';
import { ArticleCard } from '@/components/content/article-card';
import { BannerStrip } from '@/components/content/banner-strip';
import { QuizCard } from '@/components/student/quiz-card';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Link } from '@/i18n/navigation';
import { serverApi, serverPage } from '@/lib/api/server';
import type { ArticleCard as ArticleCardData, Banner } from '@/lib/content';
import { alternates } from '@/lib/seo';
import type { StudentHome } from '@/lib/student';
import { StudentFeed } from './student-feed';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'student' });
  return { title: t('title'), description: t('intro'), alternates: alternates(locale, '/student-zone') };
}

export default async function StudentZonePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();
  const [home, banners, resources, assistant] = await Promise.all([
    serverApi<StudentHome>('/student-zone', { locale, revalidate: 120 }),
    serverApi<Banner[]>('/banners?placement=student_zone', { locale, revalidate: 120 }).catch(() => null),
    serverPage<ArticleCardData>('/articles?kind=study_resource&audience=student&pageSize=4', { locale, revalidate: 120 }).catch(() => ({ items: [] as ArticleCardData[] })),
    serverApi<{ enabled: boolean }>('/ai/status', { locale, revalidate: 300 }).catch(() => null),
  ]);
  const day = (d: string) => format.dateTime(new Date(d), { day: 'numeric', month: 'short' });
  return (
    <div className="pb-10">
      <section className="bg-gradient-to-br from-secondary-soft via-surface to-primary-soft">
        <div className="container-page flex flex-wrap items-center justify-between gap-6 py-8 sm:py-10">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-soft-fg">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
              {t('nav.studentZone')}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-fg sm:text-4xl">{t('student.title')}</h1>
            <p className="mt-2 text-fg-muted">{t('student.intro')}</p>
          </div>
          <nav aria-label={t('student.tools')} className="flex flex-wrap gap-2">
            <Link href="/student-zone/notes" className={buttonClasses({ variant: 'outline' })}>
              <NotebookPen className="h-4 w-4" aria-hidden="true" />
              {t('student.myNotes')}
            </Link>
            <Link href="/student-zone/groups" className={buttonClasses({ variant: 'outline' })}>
              <Users className="h-4 w-4" aria-hidden="true" />
              {t('student.studyGroups')}
            </Link>
            {assistant?.enabled ? (
              <Link href="/assistant" className={buttonClasses({ variant: 'outline' })}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {t('assistant.studyHelper')}
              </Link>
            ) : null}
          </nav>
        </div>
      </section>

      {banners?.length ? (
        <div className="pt-6">
          <BannerStrip banners={banners} locale={locale} label={t('student.title')} priority />
        </div>
      ) : null}

      <div className="container-page space-y-10 pt-8">
        <section aria-labelledby="quizzes">
          <SectionHeader id="quizzes" title={t('student.quizzes')} description={t('student.quizzesText')} href="/student-zone/quizzes" linkLabel={t('common.viewAll')} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(home?.quizzes ?? []).map((q) => (
              <li key={q.id}>
                <QuizCard quiz={q} />
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <section aria-labelledby="student-feed" className="min-w-0">
            <SectionHeader id="student-feed" title={t('student.feed')} description={t('student.feedText')} />
            <StudentFeed />
          </section>
          <aside className="space-y-6">
            <section aria-labelledby="groups" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 id="groups" className="mb-3 font-bold text-fg">
                {t('student.studyGroups')}
              </h2>
              {home?.studyGroups.length ? (
                <ul className="space-y-2">
                  {home.studyGroups.map((g) => (
                    <li key={g.slug}>
                      <Link href={`/clubs/${g.slug}`} className="block rounded-lg px-2 py-1.5 hover:bg-subtle">
                        <span className="block font-semibold text-fg">{g.name}</span>
                        <span className="block text-xs text-fg-muted">
                          {[g.subject ? t(`subjects.${g.subject}`) : null, g.institutionName, t('clubs.members', { count: g.memberCount })].filter(Boolean).join(' · ')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">{t('student.noGroups')}</p>
              )}
              <Link href="/clubs/new?purpose=study" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                {t('clubs.newStudyGroup')}
              </Link>
            </section>

            <section aria-labelledby="events" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 id="events" className="mb-3 flex items-center gap-2 font-bold text-fg">
                <CalendarDays className="h-4 w-4 text-secondary" aria-hidden="true" />
                {t('student.events')}
              </h2>
              {home?.events.length ? (
                <ul className="space-y-3 text-sm">
                  {home.events.map((e) => (
                    <li key={e.id}>
                      <p className="font-semibold text-fg">{e.title}</p>
                      <p className="text-xs text-fg-muted">{[day(e.startsAt), e.location, e.organizer].filter(Boolean).join(' · ')}</p>
                      {e.onlineUrl ? (
                        <a href={e.onlineUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
                          {t('clubs.joinOnline')}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">{t('student.noEvents')}</p>
              )}
            </section>

            <section aria-labelledby="competitions" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 id="competitions" className="mb-3 flex items-center gap-2 font-bold text-fg">
                <Trophy className="h-4 w-4 text-accent-hover" aria-hidden="true" />
                {t('student.competitions')}
              </h2>
              {home?.competitions.length ? (
                <ul className="space-y-3 text-sm">
                  {home.competitions.map((c) => (
                    <li key={c.id}>
                      <Link href={`/student-zone/competitions/${c.slug}`} className="font-semibold text-fg hover:text-primary">
                        {c.title}
                      </Link>
                      <p className="text-xs text-fg-muted">
                        <Badge tone="success" className="mr-1.5">
                          {t(`student.competitionStatus.${c.status}`)}
                        </Badge>
                        {t('student.until', { date: day(c.endsAt) })}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">{t('student.noCompetitions')}</p>
              )}
            </section>

            <section aria-labelledby="scholarships" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 id="scholarships" className="mb-3 font-bold text-fg">
                {t('student.scholarships')}
              </h2>
              {home?.scholarships.length ? (
                <ul className="space-y-3 text-sm">
                  {home.scholarships.map((s) => (
                    <li key={s.id}>
                      <p className="font-semibold text-fg">{s.title}</p>
                      <p className="text-xs text-fg-muted">{[s.provider, s.amountText, s.deadline ? t('student.deadline', { date: day(s.deadline) }) : null].filter(Boolean).join(' · ')}</p>
                      {s.applyUrl ? (
                        <a href={s.applyUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                          {t('student.apply')}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">{t('student.noScholarships')}</p>
              )}
            </section>
          </aside>
        </div>

        {home?.textbooks.length ? (
          <Shelf id="textbooks" title={t('student.textbooks')} subtitle={t('student.textbooksText')} href="/categories/books/academic" linkLabel={t('common.viewAll')} contained={false}>
            {home.textbooks.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </Shelf>
        ) : null}

        {resources.items.length ? (
          <section aria-labelledby="resources">
            <SectionHeader id="resources" title={t('student.resources')} description={t('student.resourcesText')} href="/blog?kind=study_resource" linkLabel={t('common.viewAll')} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {resources.items.map((a) => (
                <li key={a.id}>
                  <ArticleCard article={a} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
