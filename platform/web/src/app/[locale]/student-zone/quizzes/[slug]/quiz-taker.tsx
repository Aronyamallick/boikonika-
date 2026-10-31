'use client';

import { ArrowLeft, CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/forms/errors';
import type { QuizDetail, QuizResult } from '@/lib/student';

/**
 * Take a quiz: all questions on one page, an optional countdown, then the score with each question
 * reviewed (the correct answer and explanation come from the server only after submitting).
 */
export function QuizTaker({ quiz }: { quiz: QuizDetail }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { status } = useAuth();
  const pathname = usePathname();
  const { fromApi } = useFormErrors();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>(() => quiz.questions.map(() => -1));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startedAt || result) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, result]);

  const remaining = startedAt && quiz.timeLimitSeconds ? Math.max(0, quiz.timeLimitSeconds - Math.floor((now - Date.parse(startedAt)) / 1000)) : null;
  const answered = answers.filter((a) => a >= 0).length;

  const submit = async () => {
    if (!startedAt) return;
    setBusy(true);
    try {
      const res = await api<QuizResult>(`/quizzes/${quiz.slug}/attempts`, { method: 'POST', body: { answers, startedAt } });
      setResult(res);
      setTimeout(() => resultRef.current?.focus(), 50);
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setAnswers(quiz.questions.map(() => -1));
    setResult(null);
    setStartedAt(new Date().toISOString());
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-6">
      <Link href="/student-zone/quizzes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('student.allQuizzes')}
      </Link>
      <header>
        <p className="flex flex-wrap gap-1.5">
          <Badge tone="secondary">{t(`subjects.${quiz.subject}`)}</Badge>
          <Badge tone="neutral">{t(`student.levels.${quiz.academicLevel}`)}</Badge>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-fg sm:text-3xl">{quiz.title}</h1>
        {quiz.description ? <p className="mt-1 text-fg-muted">{quiz.description}</p> : null}
        <p className="mt-2 text-sm text-fg-muted">
          {[t('student.questions', { count: quiz.questions.length }), quiz.timeLimitSeconds ? t('student.minutes', { count: Math.round(quiz.timeLimitSeconds / 60) }) : null, t('student.passMark', { percent: quiz.passPercent })].filter(Boolean).join(' · ')}
        </p>
      </header>

      {!startedAt ? (
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          {quiz.myAttempts.length ? (
            <p className="mb-3 text-sm text-fg-muted">{t('student.yourBest', { score: format.number((quiz.best ?? 0) / 100, { style: 'percent' }), count: quiz.myAttempts.length })}</p>
          ) : null}
          {status === 'anonymous' ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-fg-muted">{t('student.loginToTake')}</p>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses()}>
                {t('auth.login')}
              </Link>
            </div>
          ) : (
            <Button onClick={() => setStartedAt(new Date().toISOString())}>{t('student.start')}</Button>
          )}
        </div>
      ) : null}

      {result ? (
        <div ref={resultRef} tabIndex={-1} className="space-y-3 focus:outline-none">
          <Alert tone={result.passed ? 'success' : result.late ? 'warning' : 'info'} title={result.passed ? t('student.passedTitle') : result.late ? t('student.lateTitle') : t('student.notPassedTitle')}>
            {t('student.scoreLine', { correct: result.correctCount, total: result.total, score: format.number(result.scorePercent / 100, { style: 'percent' }), pass: result.passPercent })}
            {result.firstPass ? ` ${t('student.xpEarned')}` : ''}
          </Alert>
          <Button variant="outline" onClick={restart}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t('student.tryAgain')}
          </Button>
        </div>
      ) : null}

      {startedAt ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          {remaining !== null && !result ? (
            <p role="timer" aria-live={remaining <= 30 ? 'assertive' : 'off'} className={cn('sticky top-20 z-10 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold shadow-sm', remaining <= 30 ? 'border-danger bg-danger-soft text-danger-soft-fg' : 'border-line bg-surface text-fg')}>
              <Clock className="h-4 w-4" aria-hidden="true" />
              {t('student.timeLeft', { time: `${format.number(Math.floor(remaining / 60))}:${format.number(remaining % 60, { minimumIntegerDigits: 2 })}` })}
            </p>
          ) : null}
          <ol className="space-y-4">
            {quiz.questions.map((q, i) => {
              const r = result?.results[i];
              return (
                <li key={q.id} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                  <fieldset disabled={!!result}>
                    <legend className="font-semibold text-fg">
                      <span className="mr-2 text-fg-subtle">{format.number(i + 1)}.</span>
                      {q.prompt}
                    </legend>
                    <div className="mt-3 space-y-2">
                      {q.options.map((o, j) => {
                        const isCorrect = r && j === r.correctIndex;
                        const isWrongChoice = r && j === r.chosen && !r.correct;
                        return (
                          <label
                            key={j}
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-[15px]',
                              !r && 'hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40',
                              isCorrect && 'border-success bg-success-soft',
                              isWrongChoice && 'border-danger bg-danger-soft',
                              r && !isCorrect && !isWrongChoice && 'border-line opacity-80',
                            )}
                          >
                            <input type="radio" name={`q-${q.id}`} checked={answers[i] === j} onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))} className="accent-[var(--bk-primary)]" />
                            <span className="flex-1 text-fg">{o}</span>
                            {isCorrect ? <CheckCircle2 className="h-5 w-5 text-success-text" aria-label={t('student.correctAnswer')} /> : null}
                            {isWrongChoice ? <XCircle className="h-5 w-5 text-danger" aria-label={t('student.yourAnswerWrong')} /> : null}
                          </label>
                        );
                      })}
                    </div>
                    {r ? (
                      <p className={cn('mt-3 text-sm', r.correct ? 'text-success-soft-fg' : 'text-fg-muted')}>
                        <span className="font-semibold">{r.correct ? t('student.right') : r.chosen < 0 ? t('student.skipped') : t('student.wrong')}</span>
                        {r.explanation ? ` ${r.explanation}` : ''}
                      </p>
                    ) : null}
                  </fieldset>
                </li>
              );
            })}
          </ol>
          {!result ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
              <p className="text-sm text-fg-muted">{t('student.answered', { answered, total: quiz.questions.length })}</p>
              <Button type="submit" loading={busy}>
                {t('student.submit')}
              </Button>
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
