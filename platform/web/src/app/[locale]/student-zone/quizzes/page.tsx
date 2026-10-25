import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { serverPage } from '@/lib/api/server';
import { alternates } from '@/lib/seo';
import type { QuizCard } from '@/lib/student';
import { QuizBrowser } from './quiz-browser';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'student' });
  return { title: t('quizzes'), description: t('quizzesText'), alternates: alternates(locale, '/student-zone/quizzes') };
}

export default async function QuizzesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('student');
  const initial = await serverPage<QuizCard>('/quizzes?pageSize=24', { locale, revalidate: 120 });
  return (
    <div className="container-page space-y-6 py-6 lg:py-8">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('quizzes')}</h1>
        <p className="mt-1 text-fg-muted">{t('quizzesText')}</p>
      </header>
      <QuizBrowser initial={initial.items} />
    </div>
  );
}
