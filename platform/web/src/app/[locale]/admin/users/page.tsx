'use client';

import { ROLES, USER_STATUSES } from '@boikonika/shared';
import { Search, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { USER_STATUS_TONE } from '@/components/admin/status-tone';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api/client';

interface UserRow {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  roles: string[];
  avatarUrl: string | null;
  lastActive: string | null;
  openReports: number;
  joinedAt: string;
}
const PAGE_SIZE = 25;

/** Find people by name, username, email or phone; filter by role and account status. */
export default function AdminUsersPage() {
  const t = useTranslations('adminUsers');
  const tr = useTranslations('roles');
  const format = useFormatter();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    setRows(null);
    apiRequest<UserRow[]>('/admin/users', { query: { q: query || undefined, role: role || undefined, status: status || undefined, page, pageSize: PAGE_SIZE } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [query, role, status, page]);
  useEffect(load, [load]);
  const search = (e: FormEvent) => (e.preventDefault(), setPage(1), setQuery(q.trim()));

  return (
    <RequirePermission permission="users.view">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mb-4 mt-1 text-fg-muted">{t('text')}</p>
      <form onSubmit={search} role="search" className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="users-q" className="sr-only">
          {t('search')}
        </label>
        <Input id="users-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="h-10 min-w-56 flex-1" />
        <label htmlFor="users-role" className="sr-only">
          {t('role')}
        </label>
        <Select id="users-role" value={role} onChange={(e) => (setRole(e.target.value), setPage(1))} className="h-10 w-44">
          <option value="">{t('anyRole')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </Select>
        <label htmlFor="users-status" className="sr-only">
          {t('status')}
        </label>
        <Select id="users-status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="h-10 w-40">
          <option value="">{t('anyStatus')}</option>
          {USER_STATUSES.filter((s) => s !== 'deleted').map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
        <Button type="submit" size="icon" variant="outline" aria-label={t('search')}>
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
      {!rows ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title={t('empty')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-subtle text-left text-xs uppercase tracking-wide text-fg-subtle">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">
                  {t('person')}
                </th>
                <th scope="col" className="px-3 py-3 font-bold">
                  {t('contact')}
                </th>
                <th scope="col" className="px-3 py-3 font-bold">
                  {t('roles')}
                </th>
                <th scope="col" className="px-3 py-3 font-bold">
                  {t('status')}
                </th>
                <th scope="col" className="px-3 py-3 font-bold">
                  {t('lastActive')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id}>
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 hover:text-primary">
                      <Avatar name={u.name} src={u.avatarUrl ?? undefined} size="sm" />
                      <span>
                        <span className="block font-semibold text-fg">{u.name}</span>
                        {u.username ? <span className="block text-xs text-fg-muted">@{u.username}</span> : null}
                      </span>
                    </Link>
                  </th>
                  <td className="px-3 py-3 text-fg-muted">
                    {u.phone ? <span className="block">{u.phone}</span> : null}
                    {u.email ? <span className="block break-all">{u.email}</span> : null}
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} tone="neutral">
                          {tr(r)}
                        </Badge>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={USER_STATUS_TONE[u.status] ?? 'neutral'}>{t(`statuses.${u.status}`)}</Badge>
                    {u.openReports ? <span className="mt-1 block text-xs text-danger">{t('openReports', { count: u.openReports })}</span> : null}
                  </td>
                  <td className="px-3 py-3 text-fg-muted">{u.lastActive ? format.dateTime(new Date(u.lastActive), { dateStyle: 'medium' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AdminPager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
    </RequirePermission>
  );
}
