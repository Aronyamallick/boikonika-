import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { serverApi } from '@/lib/api/server';
import { alternates } from '@/lib/seo';
import type { QuizDetail } from '@/lib/student';
import { QuizTaker } from './quiz-taker';

type Params = Promise<{ locale: string; slug: string }>;
const load = (locale: string, slug: string) => serverApi<QuizDetail>(`/quizzes/${encodeURIComponent(decodeURIComponent(slug))}`, { locale, revalidate: 300 });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const quiz = await load(locale, slug);
  if (!quiz) return {};
  return { title: quiz.title, description: quiz.description ?? undefined, alternates: alternates(locale, `/student-zone/quizzes/${quiz.slug}`) };
}

export default async function QuizPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const quiz = await load(locale, slug);
  if (!quiz) notFound();
  return (
    <div className="container-page max-w-3xl py-6 lg:py-8">
      <QuizTaker quiz={quiz} />
    </div>
  );
}
