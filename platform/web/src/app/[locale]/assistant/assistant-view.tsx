'use client';

import { AI_BOOK_TASKS, AI_LEVELS, AI_MAX_INPUT, AI_OWNERSHIP_TASKS, AI_TEXT_TASKS, AI_WRITING_TASKS, type AiLevel, type AiTask } from '@boikonika/shared';
import { BookOpen, Check, Copy, PenLine, Search, Sparkles, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Markdown } from '@/components/content/markdown';
import { Button, buttonClasses } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import type { BookCardData } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface Status {
  enabled: boolean;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
}
type Picked = { id: string; title: string; coverUrl: string | null; authors: string };

/** Which extra fields each task shows. */
const USES_BOOK: readonly AiTask[] = ['explain', 'questions', 'vocabulary', 'reading_plan'];
const USES_LEVEL: readonly AiTask[] = ['explain', 'questions', 'reading_plan'];
const USES_COUNT: readonly AiTask[] = ['questions', 'vocabulary', 'brainstorm'];
const isText = (task: AiTask) => (AI_TEXT_TASKS as readonly string[]).includes(task);

export function AssistantView({ initialBook, initialTask }: { initialBook?: string; initialTask?: string }) {
  const t = useTranslations('assistant');
  const locale = useLocale();
  const toast = useToast();
  const { status: authStatus } = useAuth();
  const { fromApi } = useFormErrors();
  const [status, setStatus] = useState<Status | null>(null);
  const firstTask = ([...AI_BOOK_TASKS, ...AI_WRITING_TASKS] as readonly string[]).includes(initialTask ?? '') ? (initialTask as AiTask) : 'explain';
  const [mode, setMode] = useState<'book' | 'writing'>((AI_WRITING_TASKS as readonly string[]).includes(firstTask) ? 'writing' : 'book');
  const [task, setTask] = useState<AiTask>(firstTask);
  const [input, setInput] = useState('');
  const [book, setBook] = useState<Picked | null>(null);
  const [language, setLanguage] = useState<'bn' | 'en'>(locale === 'en' ? 'en' : 'bn');
  const [level, setLevel] = useState<AiLevel>('general');
  const [count, setCount] = useState('8');
  const [days, setDays] = useState('14');
  const [minutes, setMinutes] = useState('30');
  const [ownText, setOwnText] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ task: AiTask; output: string; truncated: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authStatus === 'loading') return;
    api<Status>('/ai/status').then(setStatus, () => setStatus({ enabled: false, dailyLimit: 0, usedToday: 0, remainingToday: 0 }));
  }, [authStatus]);
  // Arriving from a book page ("?book=slug") starts with that book chosen.
  useEffect(() => {
    if (!initialBook) return;
    api<{ id: string; title: string; coverUrl: string | null; contributors: Array<{ name: string; role: string }> }>(`/books/${encodeURIComponent(initialBook)}`).then(
      (b) => setBook({ id: b.id, title: b.title, coverUrl: b.coverUrl, authors: b.contributors.filter((c) => c.role === 'author').map((c) => c.name).join(', ') }),
      () => undefined,
    );
  }, [initialBook]);

  const tasks = mode === 'book' ? AI_BOOK_TASKS : AI_WRITING_TASKS;
  const chooseMode = (m: 'book' | 'writing') => (setMode(m), setTask(m === 'book' ? 'explain' : 'grammar'), setErrors({}));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const res = await apiRequest<{ task: AiTask; output: string; truncated: boolean; remainingToday: number }>('/ai/assist', {
        method: 'POST',
        body: {
          task,
          input,
          bookId: USES_BOOK.includes(task) ? book?.id : undefined,
          language,
          level: USES_LEVEL.includes(task) ? level : undefined,
          count: USES_COUNT.includes(task) ? Number(count) : undefined,
          days: task === 'reading_plan' ? Number(days) : undefined,
          minutesPerDay: task === 'reading_plan' ? Number(minutes) : undefined,
          ownText,
        },
      });
      setAnswer({ task: res.data.task, output: res.data.output, truncated: res.data.truncated });
      setStatus((s) => (s ? { ...s, remainingToday: res.data.remainingToday, usedToday: s.dailyLimit - res.data.remainingToday } : s));
      requestAnimationFrame(() => document.getElementById('assistant-answer')?.focus());
    } catch (err) {
      const parsed = fromApi(err);
      setErrors(parsed.fields);
      if (!Object.keys(parsed.fields).length) toast.show(parsed.message, 'danger');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!answer) return;
    await navigator.clipboard.writeText(answer.output).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!status || authStatus === 'loading') return <Skeleton className="h-96 w-full" />;
  if (!status.enabled) return <EmptyState icon={<Sparkles className="h-6 w-6" />} title={t('unavailable')} text={t('unavailableText')} />;
  if (authStatus !== 'authenticated')
    return (
      <EmptyState
        icon={<Sparkles className="h-6 w-6" />}
        title={t('signInTitle')}
        text={t('signInText')}
        action={
          <Link href={`/login?next=${encodeURIComponent('/assistant')}`} className={buttonClasses({})}>
            {t('signIn')}
          </Link>
        }
      />
    );

  const inputLabel = t(`inputLabel.${task}`);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={submit} noValidate className="space-y-5 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-subtle p-1" role="group" aria-label={t('mode')}>
          {(['book', 'writing'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => chooseMode(m)} className={cn('inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold', mode === m ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg')}>
              {m === 'book' ? <BookOpen className="h-4 w-4" aria-hidden="true" /> : <PenLine className="h-4 w-4" aria-hidden="true" />}
              {t(`modes.${m}`)}
            </button>
          ))}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-fg">{t('whatToDo')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {tasks.map((x) => (
              <label key={x} className={cn('flex cursor-pointer gap-2.5 rounded-lg border p-3 text-sm', task === x ? 'border-primary bg-primary-soft/50' : 'border-line hover:border-line-input')}>
                <input type="radio" name="task" value={x} checked={task === x} onChange={() => (setTask(x), setErrors({}))} className="mt-0.5 accent-[var(--bk-primary)]" />
                <span>
                  <span className="block font-semibold text-fg">{t(`tasks.${x}`)}</span>
                  <span className="block text-xs text-fg-muted">{t(`taskHints.${x}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {USES_BOOK.includes(task) ? <BookPicker book={book} onChange={setBook} optional={task !== 'reading_plan' || !!input} /> : null}

        <Field label={inputLabel} hint={isText(task) ? t('ownTextHint') : t(`inputHint.${task}`)} error={errors.input} required={isText(task) || !book}>
          {(p) => <Textarea {...p} value={input} onChange={(e) => setInput(e.target.value)} rows={isText(task) ? 10 : 4} maxLength={AI_MAX_INPUT} placeholder={t(`placeholder.${task}`)} />}
        </Field>
        {isText(task) ? <p className="-mt-3 text-right text-xs text-fg-subtle">{t('characters', { count: input.length, max: AI_MAX_INPUT })}</p> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('answerIn')}>
            {(p) => (
              <Select {...p} value={language} onChange={(e) => setLanguage(e.target.value as 'bn' | 'en')}>
                <option value="bn">বাংলা</option>
                <option value="en">English</option>
              </Select>
            )}
          </Field>
          {USES_LEVEL.includes(task) ? (
            <Field label={t('level')}>
              {(p) => (
                <Select {...p} value={level} onChange={(e) => setLevel(e.target.value as AiLevel)}>
                  {AI_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`levels.${l}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          {USES_COUNT.includes(task) ? (
            <Field label={t(`countLabel.${task as 'questions' | 'vocabulary' | 'brainstorm'}`)} error={errors.count}>
              {(p) => <Input {...p} type="number" min={3} max={15} value={count} onChange={(e) => setCount(e.target.value)} />}
            </Field>
          ) : null}
          {task === 'reading_plan' ? (
            <>
              <Field label={t('days')} error={errors.days}>
                {(p) => <Input {...p} type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} />}
              </Field>
              <Field label={t('minutesPerDay')} error={errors.minutesPerDay}>
                {(p) => <Input {...p} type="number" min={5} max={240} value={minutes} onChange={(e) => setMinutes(e.target.value)} />}
              </Field>
            </>
          ) : null}
        </div>

        {(AI_OWNERSHIP_TASKS as readonly string[]).includes(task) ? (
          <div>
            <Checkbox label={t('ownText')} checked={ownText} onChange={(e) => setOwnText(e.target.checked)} aria-invalid={errors.ownText ? true : undefined} />
            {errors.ownText ? (
              <p className="pl-7 text-sm text-danger" role="alert">
                {errors.ownText}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg-muted" aria-live="polite">
            {t('remaining', { count: status.remainingToday })}
          </p>
          <Button type="submit" loading={busy} disabled={status.remainingToday === 0}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t('ask')}
          </Button>
        </div>
        <p className="text-xs text-fg-subtle">{t('privacy')}</p>
      </form>

      <section aria-labelledby="assistant-answer-title" className="min-w-0">
        <h2 id="assistant-answer-title" className="sr-only">
          {t('answer')}
        </h2>
        {busy ? (
          <div className="space-y-3 rounded-xl border border-line bg-surface p-5 shadow-sm" role="status">
            <p className="text-sm text-fg-muted">{t('thinking')}</p>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : answer ? (
          <article id="assistant-answer" tabIndex={-1} className="rounded-xl border border-line bg-surface p-5 shadow-sm focus:outline-none" lang={language}>
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-3">
              <p className="text-sm font-semibold text-fg-muted">{t(`tasks.${answer.task}`)}</p>
              <Button size="sm" variant="ghost" onClick={copy}>
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? t('copied') : t('copy')}
              </Button>
            </div>
            <Markdown source={answer.output} />
            {answer.truncated ? <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-fg">{t('truncated')}</p> : null}
            <p className="mt-4 border-t border-line pt-3 text-xs text-fg-subtle">{t('checkIt')}</p>
          </article>
        ) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-line p-6 text-center text-sm text-fg-muted">
            <Sparkles className="mb-2 h-6 w-6 text-primary" aria-hidden="true" />
            {t('emptyAnswer')}
          </div>
        )}
      </section>
    </div>
  );
}

/** Choose the book the question is about (optional for most tasks). */
function BookPicker({ book, onChange, optional }: { book: Picked | null; onChange: (b: Picked | null) => void; optional: boolean }) {
  const t = useTranslations('assistant');
  const id = useId();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<BookCardData[] | null>(null);
  const search = () => {
    if (q.trim().length < 2) return;
    setResults(null);
    api<BookCardData[]>('/books', { query: { q: q.trim(), pageSize: 6 } }).then(setResults, () => setResults([]));
  };
  if (book)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-subtle p-2.5 text-sm">
        {book.coverUrl ? <img src={book.coverUrl} alt="" className="h-14 w-10 rounded object-cover" /> : <span className="h-14 w-10 rounded bg-line" />}
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-fg-subtle">{t('aboutBook')}</span>
          <span className="block truncate font-semibold text-fg">{book.title}</span>
          {book.authors ? <span className="block truncate text-xs text-fg-muted">{book.authors}</span> : null}
        </span>
        <button type="button" onClick={() => onChange(null)} className="rounded p-1.5 text-fg-muted hover:bg-surface hover:text-fg" aria-label={t('removeBook')}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-fg">
        {t('chooseBook')} {optional ? <span className="font-normal text-fg-subtle">({t('optional')})</span> : null}
      </label>
      <div className="flex gap-2">
        <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())} placeholder={t('findBook')} className="h-10 flex-1" />
        <Button type="button" size="icon" variant="outline" onClick={search} aria-label={t('findBook')}>
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {results ? (
        results.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('noBooks')}</p>
        ) : (
          <ul className="max-h-56 divide-y divide-line overflow-auto rounded-lg border border-line">
            {results.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => (onChange({ id: b.id, title: b.title, coverUrl: b.coverUrl, authors: b.authors.map((a) => a.name).join(', ') }), setResults(null), setQ(''))} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-subtle">
                  {b.coverUrl ? <img src={b.coverUrl} alt="" className="h-10 w-7 rounded object-cover" /> : <span className="h-10 w-7 rounded bg-subtle" />}
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-fg">{b.title}</span>
                    <span className="block truncate text-xs text-fg-muted">{b.authors.map((a) => a.name).join(', ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
