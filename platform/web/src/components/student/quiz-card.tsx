import { CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import type { QuizCard as Quiz } from '@/lib/student';

export function QuizCard({ quiz }: { quiz: Quiz }) {
  const t = useTranslations();
  const format = useFormatter();
  return (
    <article className="flex h-full flex-col rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="flex flex-wrap gap-1.5">
        <Badge tone="secondary">{t(`subjects.${quiz.subject}`)}</Badge>
        <Badge tone="neutral">{t(`student.levels.${quiz.academicLevel}`)}</Badge>
        {quiz.passed ? (
          <Badge tone="success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('student.passedBadge')}
          </Badge>
        ) : null}
      </p>
      <h3 className="mt-2 font-bold leading-snug text-fg">
        <Link href={`/student-zone/quizzes/${quiz.slug}`} className="hover:text-primary">
          {quiz.title}
        </Link>
      </h3>
      {quiz.description ? <p className="mt-1 line-clamp-2 flex-1 text-sm text-fg-muted">{quiz.description}</p> : <span className="flex-1" />}
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {t('student.questions', { count: quiz.questionCount })}
        </span>
        {quiz.timeLimitSeconds ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {t('student.minutes', { count: Math.round(quiz.timeLimitSeconds / 60) })}
          </span>
        ) : null}
        {quiz.best !== null ? <span>{t('student.best', { score: format.number(quiz.best / 100, { style: 'percent' }) })}</span> : null}
      </p>
    </article>
  );
}
