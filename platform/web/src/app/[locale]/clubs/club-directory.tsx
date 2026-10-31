'use client';

import { CLUB_TYPES } from '@boikonika/shared';
import { Plus, Search, UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { ClubCard } from '@/components/clubs/club-card';
import { buttonClasses } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import type { ClubCard as Club } from '@/lib/clubs';

/** Search and filter clubs; signed-in readers see their membership and can switch to "My clubs". */
export function ClubDirectory({ initial, initialTotal, purpose }: { initial: Club[]; initialTotal: number; purpose?: 'study' | 'reading' }) {
  const t = useTranslations();
  const { status } = useAuth();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [mine, setMine] = useState(false);
  const [items, setItems] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const first = useRef(true);

  useEffect(() => {
    // The server already rendered the first page for visitors.
    if (first.current && status !== 'authenticated') return;
    first.current = false;
    const timer = setTimeout(() => {
      apiRequest<Club[]>('/clubs', { query: { q: q.trim() || undefined, type: type || undefined, purpose, mine: mine ? 'true' : undefined, page, pageSize: 18 } }).then(
        (res) => (setItems((prev) => (page === 1 ? res.data : [...prev, ...res.data])), setTotal(res.meta?.total ?? 0)),
        () => undefined,
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [q, type, mine, page, purpose, status]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <label htmlFor="club-search" className="sr-only">
            {t('clubs.search')}
          </label>
          <Input id="club-search" type="search" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder={t('clubs.search')} className="pl-9" />
        </div>
        <label htmlFor="club-type" className="sr-only">
          {t('clubs.type')}
        </label>
        <Select id="club-type" value={type} onChange={(e) => (setType(e.target.value), setPage(1))} className="w-auto">
          <option value="">{t('clubs.allTypes')}</option>
          {CLUB_TYPES.map((k) => (
            <option key={k} value={k}>
              {t(`clubs.types.${k}`)}
            </option>
          ))}
        </Select>
        {status === 'authenticated' ? (
          <button
            type="button"
            aria-pressed={mine}
            onClick={() => (setMine((v) => !v), setPage(1))}
            className={cn('h-11 rounded-lg px-4 text-sm font-semibold', mine ? 'bg-primary text-primary-fg' : 'border border-line-input bg-surface text-fg hover:bg-subtle')}
          >
            {t('clubs.myClubs')}
          </button>
        ) : null}
        <Link href={status === 'authenticated' ? `/clubs/new${purpose === 'study' ? '?purpose=study' : ''}` : '/login?next=/clubs/new'} className={buttonClasses()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {purpose === 'study' ? t('clubs.newStudyGroup') : t('clubs.newClub')}
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<UsersRound className="h-6 w-6" />} title={mine ? t('clubs.noMine') : t('clubs.none')} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <li key={c.id}>
              <ClubCard club={c} />
            </li>
          ))}
        </ul>
      )}
      {items.length < total ? (
        <div className="text-center">
          <button type="button" onClick={() => setPage((p) => p + 1)} className={buttonClasses({ variant: 'outline' })}>
            {t('community.loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
