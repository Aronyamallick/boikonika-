'use client';

import { BookOpen, CalendarDays, Clock, FileText, Trophy, Users } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/forms/errors';
import { localized, type Challenge } from '@/lib/reading';

export const CHALLENGE_ICONS = { days: CalendarDays, pages: FileText, books: BookOpen, minutes: Clock } as const;

/** Challenge cards with the signed-in reader's progress and a join / leave action. */
export function ChallengeList({ initial }: { initial: Challenge[] }) {
  const { status } = useAuth();
  const [items, setItems] = useState(initial);
  const reload = () => api<Challenge[]>('/challenges').then(setItems, () => undefined);
  useEffect(() => {
    if (status === 'authenticated') void reload();
  }, [status]);
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => (
        <li key={c.id}>
          <ChallengeCard challenge={c} onChanged={reload} />
        </li>
      ))}
    </ul>
  );
}

export function ChallengeCard({ challenge: c, onChanged, detail = false }: { challenge: Challenge; onChanged: () => void; detail?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const pathname = usePathname();
  const { status } = useAuth();
  const { fromApi } = useFormErrors();
  const [busy, setBusy] = useState(false);
  const Icon = CHALLENGE_ICONS[c.type];
  const mine = c.mine;
  const active = mine?.status === 'active';
  const ratio = mine ? Math.min(1, mine.progress / c.target) : 0;

  const act = async (join: boolean) => {
    setBusy(true);
    try {
      const res = await apiRequest(`/challenges/${c.slug}/join`, { method: join ? 'POST' : 'DELETE' });
      toast.show(res.message, 'success');
      onChanged();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={cn('flex h-full flex-col rounded-xl border bg-surface p-5 shadow-sm', mine?.status === 'completed' ? 'border-success' : 'border-line')}>
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-secondary-soft p-2.5 text-secondary-soft-fg">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-fg">{detail ? localized(c.title, locale) : <Link href={`/challenges/${c.slug}`} className="hover:text-primary">{localized(c.title, locale)}</Link>}</h2>
          <p className="mt-0.5 text-sm text-fg-muted">{t(`challenges.goal.${c.type}`, { count: c.target })}</p>
        </div>
        {mine ? <Badge tone={mine.status === 'completed' ? 'success' : mine.status === 'active' ? 'primary' : 'neutral'}>{t(`challenges.status.${mine.status}`)}</Badge> : null}
      </div>
      <p className="mt-3 flex-1 text-sm text-fg">{localized(c.description, locale)}</p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        {c.durationDays ? (
          <li className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {t('challenges.duration', { count: c.durationDays })}
          </li>
        ) : null}
        <li className="inline-flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          {t('challenges.reward', { xp: c.xpReward })}
        </li>
        <li className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {t('challenges.participants', { count: c.participantCount })}
        </li>
      </ul>
      {mine && mine.status !== 'abandoned' ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-primary-soft" role="progressbar" aria-label={t('challenges.progress')} aria-valuemin={0} aria-valuemax={c.target} aria-valuenow={Math.min(mine.progress, c.target)}>
            <div className={cn('h-full rounded-full', mine.status === 'completed' ? 'bg-success' : 'bg-primary')} style={{ width: `${ratio * 100}%` }} />
          </div>
          <p className="mt-1 flex justify-between text-xs text-fg-muted">
            <span>{t('challenges.progressValue', { progress: Math.min(mine.progress, c.target), target: c.target })}</span>
            {active && mine.deadlineAt ? <span>{t('challenges.endsOn', { date: format.dateTime(new Date(mine.deadlineAt), { dateStyle: 'medium' }) })}</span> : null}
          </p>
        </div>
      ) : null}
      <div className="mt-4">
        {status === 'anonymous' ? (
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
            {t('challenges.loginToJoin')}
          </Link>
        ) : active ? (
          <Button size="sm" variant="ghost" loading={busy} onClick={() => act(false)}>
            {t('challenges.leave')}
          </Button>
        ) : mine?.status === 'completed' ? null : (
          <Button size="sm" loading={busy} onClick={() => act(true)}>
            {mine ? t('challenges.restart') : t('challenges.join')}
          </Button>
        )}
      </div>
    </article>
  );
}
