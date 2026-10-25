'use client';

import { formatMoney } from '@boikonika/shared';
import { ArrowLeft, ExternalLink, ShieldAlert } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { USER_STATUS_TONE } from '@/components/admin/status-tone';
import { useAuth } from '@/components/auth/auth-provider';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface UserDetail {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  status: string;
  suspendedUntil: string | null;
  twoFactor: boolean;
  locale: string;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  institution: string | null;
  roles: string[];
  joinedAt: string;
  lastActive: string | null;
  kycStatus: string | null;
  seller: { status: string; store: string | null; name: string | null } | null;
  authorSlug: string | null;
  publisherSlug: string | null;
  stats: { orders: number; spent: string; posts: number; reviews: number; reportsFiled: number; reportsAgainst: number; sessions: number };
  moderation: {
    actions: Array<{ id: string; action: string; reason: string; targetType: string; expiresAt: string | null; revertedAt: string | null; createdAt: string; actor?: string | null }>;
    restrictions: Array<{ scope: string; reason: string | null; until: string | null; since: string }>;
  };
}

/** One person, as staff see them: contact, roles, activity, standing and the moderation record. */
export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('adminUsers');
  const tm = useTranslations('adminModeration');
  const tr = useTranslations('roles');
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { can } = useAuth();
  const { fromApi } = useFormErrors();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [changing, setChanging] = useState(false);
  const [next, setNext] = useState<'suspended' | 'banned' | 'active'>('suspended');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('7');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reverting, setReverting] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState('');

  const load = useCallback(() => {
    api<UserDetail>(`/admin/users/${id}`).then(setUser, () => setFailed(true));
  }, [id]);
  useEffect(load, [load]);

  const changeStatus = async () => {
    setErrors({});
    try {
      const res = await apiRequest(`/admin/users/${id}/status`, { method: 'PUT', body: { status: next, reason, days: next === 'suspended' ? Number(days) : undefined } });
      toast.show(res.message, 'success');
      setChanging(false);
      load();
    } catch (err) {
      const parsed = fromApi(err);
      setErrors(parsed.fields);
      if (!Object.keys(parsed.fields).length) toast.show(parsed.message, 'danger');
    }
  };
  const revert = async (actionId: string) => {
    try {
      const res = await apiRequest(`/admin/moderation/actions/${actionId}/revert`, { method: 'POST', body: { reason: revertReason } });
      toast.show(res.message, 'success');
      setReverting(null);
      load();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };

  if (failed) return <ErrorState title={t('notFound')} />;
  if (!user) return <Skeleton className="h-96 w-full" />;
  const date = (d: string) => format.dateTime(new Date(d), { dateStyle: 'medium' });
  const stats: Array<[string, string]> = [
    [t('stat.orders'), format.number(user.stats.orders)],
    [t('stat.spent'), formatMoney(user.stats.spent, locale, { hideZeroDecimals: true })],
    [t('stat.posts'), format.number(user.stats.posts)],
    [t('stat.reviews'), format.number(user.stats.reviews)],
    [t('stat.reportsFiled'), format.number(user.stats.reportsFiled)],
    [t('stat.reportsAgainst'), format.number(user.stats.reportsAgainst)],
    [t('stat.sessions'), format.number(user.stats.sessions)],
  ];

  return (
    <RequirePermission permission="users.view">
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('back')}
      </Link>
      <header className="flex flex-wrap items-start gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <Avatar name={user.name} src={user.avatarUrl ?? undefined} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            {user.name}
            <Badge tone={USER_STATUS_TONE[user.status] ?? 'neutral'}>{t(`statuses.${user.status}`)}</Badge>
          </h1>
          {user.username ? (
            <Link href={`/u/${user.username}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-primary">
              @{user.username}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : null}
          {user.suspendedUntil ? <p className="mt-1 text-sm text-warning-soft-fg">{t('suspendedUntil', { date: date(user.suspendedUntil) })}</p> : null}
          <p className="mt-2 flex flex-wrap gap-1">
            {user.roles.map((r) => (
              <Badge key={r} tone="neutral">
                {tr(r)}
              </Badge>
            ))}
          </p>
        </div>
        {can('users.ban') ? (
          <div className="flex flex-wrap gap-2">
            {user.status === 'active' ? (
              <>
                <Button size="sm" variant="outline" onClick={() => (setNext('suspended'), setReason(''), setErrors({}), setChanging(true))}>
                  {t('suspend')}
                </Button>
                <Button size="sm" variant="danger" onClick={() => (setNext('banned'), setReason(''), setErrors({}), setChanging(true))}>
                  {t('ban')}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => (setNext('active'), setReason(''), setErrors({}), setChanging(true))}>
                {t('reactivate')}
              </Button>
            )}
          </div>
        ) : null}
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <section aria-labelledby="u-stats" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <h2 id="u-stats" className="mb-3 font-bold">
              {t('activity')}
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-fg-muted">{label}</dt>
                  <dd className="text-lg font-bold text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="u-mod" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <h2 id="u-mod" className="mb-3 flex items-center gap-2 font-bold">
              <ShieldAlert className="h-5 w-5 text-warning" aria-hidden="true" />
              {t('moderation')}
            </h2>
            {user.moderation.restrictions.length ? (
              <ul className="mb-3 space-y-1 text-sm">
                {user.moderation.restrictions.map((r, i) => (
                  <li key={i} className="rounded-lg bg-warning-soft px-3 py-2 text-warning-soft-fg">
                    {t('restricted', { scope: tm(`scopes.${r.scope}`), until: r.until ? date(r.until) : t('noEnd') })}
                  </li>
                ))}
              </ul>
            ) : null}
            {user.moderation.actions.length === 0 ? (
              <p className="text-sm text-fg-muted">{t('cleanRecord')}</p>
            ) : (
              <ol className="divide-y divide-line text-sm">
                {user.moderation.actions.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg">
                        {tm(`actions.${a.action}`)} <span className="font-normal text-fg-muted">· {tm(`types.${a.targetType}`)}</span>
                        {a.revertedAt ? (
                          <Badge tone="neutral" className="ml-2">
                            {t('reverted')}
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-fg-muted">{a.reason}</p>
                      <p className="text-xs text-fg-subtle">
                        {date(a.createdAt)}
                        {a.actor ? ` · ${a.actor}` : ''}
                        {a.expiresAt ? ` · ${t('until', { date: date(a.expiresAt) })}` : ''}
                      </p>
                    </div>
                    {!a.revertedAt && a.action !== 'no_action' && a.action !== 'warning' && can('reports.resolve') ? (
                      reverting === a.id ? (
                        <span className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
                          <label htmlFor={`revert-${a.id}`} className="sr-only">
                            {t('revertReason')}
                          </label>
                          <Input id={`revert-${a.id}`} value={revertReason} onChange={(e) => setRevertReason(e.target.value)} placeholder={t('revertReason')} maxLength={1000} className="h-9 min-w-48 flex-1" />
                          <Button size="sm" variant="outline" onClick={() => revert(a.id)} disabled={revertReason.trim().length < 5}>
                            {t('confirmRevert')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setReverting(null)}>
                            {tc('cancel')}
                          </Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => (setRevertReason(''), setReverting(a.id))}>
                          {t('revert')}
                        </Button>
                      )
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <aside className="space-y-3 rounded-xl border border-line bg-surface p-5 text-sm shadow-sm">
          <h2 className="font-bold">{t('details')}</h2>
          <dl className="space-y-2">
            <Detail label={t('phone')} value={user.phone ? `${user.phone}${user.phoneVerified ? ' ✓' : ''}` : '—'} />
            <Detail label={t('email')} value={user.email ? `${user.email}${user.emailVerified ? ' ✓' : ''}` : '—'} />
            <Detail label={t('twoFactor')} value={user.twoFactor ? t('on') : t('off')} />
            <Detail label={t('joined')} value={date(user.joinedAt)} />
            <Detail label={t('lastActive')} value={user.lastActive ? date(user.lastActive) : '—'} />
            <Detail label={t('kyc')} value={user.kycStatus ? t(`kycStatuses.${user.kycStatus}`) : '—'} />
            {user.seller ? <Detail label={t('store')} value={user.seller.store ? <Link href={`/stores/${user.seller.store}`} className="text-primary hover:underline">{user.seller.name}</Link> : '—'} /> : null}
            {user.authorSlug ? <Detail label={t('authorPage')} value={<Link href={`/authors/${user.authorSlug}`} className="text-primary hover:underline">{user.authorSlug}</Link>} /> : null}
            {user.publisherSlug ? <Detail label={t('publisherPage')} value={<Link href={`/publishers/${user.publisherSlug}`} className="text-primary hover:underline">{user.publisherSlug}</Link>} /> : null}
            {user.institution ? <Detail label={t('institution')} value={user.institution} /> : null}
            {user.location ? <Detail label={t('location')} value={user.location} /> : null}
          </dl>
          {can('roles.view') ? (
            <Link href="/admin/roles" className="inline-block font-semibold text-primary hover:underline">
              {t('manageRoles')}
            </Link>
          ) : null}
        </aside>
      </div>

      <Dialog
        open={changing}
        onClose={() => setChanging(false)}
        title={t(`changeTitle.${next}`, { name: user.name })}
        closeLabel={tc('close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setChanging(false)}>
              {tc('cancel')}
            </Button>
            <Button variant={next === 'active' ? 'primary' : 'danger'} onClick={changeStatus}>
              {t(next === 'active' ? 'reactivate' : next === 'banned' ? 'ban' : 'suspend')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">{t(`changeText.${next}`)}</p>
          {next === 'suspended' ? (
            <Field label={t('days')} error={errors.days} required>
              {(p) => <Input {...p} type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />}
            </Field>
          ) : null}
          <Field label={t('reason')} hint={t('reasonHint')} error={errors.reason} required>
            {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />}
          </Field>
        </div>
      </Dialog>
    </RequirePermission>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-all text-right text-fg">{value}</dd>
    </div>
  );
}
