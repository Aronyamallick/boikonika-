'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Avatar } from '@/components/ui/avatar';
import { RelativeTime } from '@/components/ui/relative-time';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import type { Challenge } from '@/lib/reading';
import { ChallengeCard } from '../challenge-list';

export interface ChallengeDetailData extends Challenge {
  completedCount: number;
  recentFinishers: Array<{ username: string; name: string; avatarUrl: string | null; completedAt: string }>;
}

export function ChallengeDetail({ initial }: { initial: ChallengeDetailData }) {
  const t = useTranslations('challenges');
  const { status } = useAuth();
  const [data, setData] = useState(initial);
  const reload = useCallback(() => api<ChallengeDetailData>(`/challenges/${initial.slug}`).then(setData, () => undefined), [initial.slug]);
  useEffect(() => {
    if (status === 'authenticated') void reload();
  }, [status, reload]);
  return (
    <div className="space-y-6">
      <Link href="/challenges" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('all')}
      </Link>
      <ChallengeCard challenge={data} onChanged={reload} detail />
      <section aria-labelledby="how" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="how" className="font-bold text-fg">
          {t('howItWorks')}
        </h2>
        <p className="mt-2 text-sm text-fg-muted">{t(`how.${data.type}`)}</p>
      </section>
      <section aria-labelledby="finishers" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="finishers" className="font-bold text-fg">
          {t('finishers', { count: data.completedCount })}
        </h2>
        {data.recentFinishers.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">{t('beFirst')}</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.recentFinishers.map((f) => (
              <li key={f.username} className="flex items-center gap-3">
                <Avatar name={f.name} src={f.avatarUrl} size="sm" />
                <span className="min-w-0 text-sm">
                  <Link href={`/u/${f.username}`} className="font-semibold text-fg hover:text-primary">
                    {f.name}
                  </Link>
                  <RelativeTime date={f.completedAt} className="block text-xs text-fg-subtle" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
