'use client';

import { ArrowLeft, Medal, Trophy } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import type { PostView } from '@/lib/community';
import { useFormErrors } from '@/lib/forms/errors';
import type { Competition } from '@/lib/student';

export interface CompetitionDetail extends Competition {
  results: Array<{ status: string; score: number | null; postId: string; title: string | null; author: { username: string; name: string } }>;
  myEntry: { status: string; postId: string } | null;
}

export function CompetitionView({ initial }: { initial: CompetitionDetail }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const pathname = usePathname();
  const { status, user } = useAuth();
  const { fromApi } = useFormErrors();
  const [c, setC] = useState(initial);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [postId, setPostId] = useState('');
  const reload = useCallback(() => api<CompetitionDetail>(`/competitions/${initial.slug}`).then(setC, () => undefined), [initial.slug]);
  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    void reload();
    apiRequest<PostView[]>(`/users/${user.username}/posts`, { query: { limit: 50 } }).then((r) => setPosts(r.data.filter((p) => p.status === 'published' && p.visibility === 'public')), () => undefined);
  }, [status, user, reload]);

  const open = c.status === 'open' && Date.now() >= Date.parse(c.startsAt) && Date.now() <= Date.parse(c.endsAt);
  const enter = async () => {
    try {
      const res = await apiRequest(`/competitions/${c.slug}/entries`, { method: 'POST', body: { postId } });
      toast.show(res.message, 'success');
      void reload();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };
  const when = (d: string) => format.dateTime(new Date(d), { dateStyle: 'medium' });

  return (
    <div className="space-y-6">
      <Link href="/student-zone" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('nav.studentZone')}
      </Link>
      <header>
        <p className="flex flex-wrap gap-1.5">
          <Badge tone={c.status === 'open' ? 'success' : 'neutral'}>{t(`student.competitionStatus.${c.status}`)}</Badge>
          <Badge tone="secondary">{t(`student.competitionKinds.${c.kind}`)}</Badge>
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-fg sm:text-3xl">
          <Trophy className="h-7 w-7 text-accent-hover" aria-hidden="true" />
          {c.title}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {t('student.runs', { from: when(c.startsAt), to: when(c.endsAt) })} · {t('student.entries', { count: c.entryCount })}
        </p>
      </header>
      <section aria-labelledby="rules" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="rules" className="font-bold text-fg">
          {t('student.rules')}
        </h2>
        <p className="mt-2 whitespace-pre-line text-fg">{c.rules}</p>
        {c.prizes ? (
          <>
            <h3 className="mt-4 font-bold text-fg">{t('student.prizes')}</h3>
            <p className="mt-1 whitespace-pre-line text-fg">{c.prizes}</p>
          </>
        ) : null}
      </section>

      <section aria-labelledby="enter" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="enter" className="font-bold text-fg">
          {t('student.yourEntry')}
        </h2>
        {c.myEntry ? (
          <p className="mt-2 text-sm text-fg">
            {t('student.entryStatus', { status: t(`student.entryStatuses.${c.myEntry.status}`) })}{' '}
            <Link href={`/posts/${c.myEntry.postId}`} className="font-semibold text-primary hover:underline">
              {t('student.viewEntry')}
            </Link>
          </p>
        ) : status === 'anonymous' ? (
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses({ className: 'mt-3' })}>
            {t('student.loginToEnter')}
          </Link>
        ) : !open ? (
          <p className="mt-2 text-sm text-fg-muted">{t('student.notOpen')}</p>
        ) : posts.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">
            {t('student.writeFirst')}{' '}
            <Link href="/community" className="font-semibold text-primary hover:underline">
              {t('community.title')}
            </Link>
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label htmlFor="entry-post" className="sr-only">
              {t('student.choosePost')}
            </label>
            <Select id="entry-post" value={postId} onChange={(e) => setPostId(e.target.value)} className="w-auto max-w-full">
              <option value="">{t('student.choosePost')}</option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title ?? p.body.slice(0, 60)}
                </option>
              ))}
            </Select>
            <Button disabled={!postId} onClick={enter}>
              {t('student.submitEntry')}
            </Button>
          </div>
        )}
      </section>

      {c.status === 'closed' ? (
        <section aria-labelledby="results" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 id="results" className="font-bold text-fg">
            {t('student.results')}
          </h2>
          {c.results.length === 0 ? (
            <p className="mt-2 text-sm text-fg-muted">{t('student.noResults')}</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {c.results.map((r) => (
                <li key={r.postId} className="flex items-center gap-3 text-sm">
                  <Medal className={r.status === 'winner' ? 'h-5 w-5 text-accent-hover' : 'h-5 w-5 text-fg-subtle'} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <Link href={`/posts/${r.postId}`} className="font-semibold text-fg hover:text-primary">
                      {r.title ?? t('community.postBy', { name: r.author.name })}
                    </Link>
                    <span className="block text-xs text-fg-muted">
                      {r.author.name} · {t(`student.entryStatuses.${r.status}`)}
                    </span>
                  </span>
                  {r.score !== null ? <span className="font-bold tabular-nums text-fg">{format.number(r.score)}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );
}
