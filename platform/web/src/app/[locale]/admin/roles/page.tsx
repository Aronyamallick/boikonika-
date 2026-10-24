'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/forms/errors';

interface RoleRow {
  key: string;
  name: string;
  description: string | null;
  isStaff: boolean;
  userCount: number;
  permissions: string[];
}

export default function RolesPage() {
  const t = useTranslations();
  const toast = useToast();
  const { can } = useAuth();
  const { fromApi } = useFormErrors();
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [catalogue, setCatalogue] = useState<Array<{ key: string; description: string }>>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([api<RoleRow[]>('/admin/roles'), api<Array<{ key: string; description: string }>>('/admin/permissions')]).then(
      ([r, p]) => (setRoles(r), setCatalogue(p)),
      (e) => setError(fromApi(e).message),
    );
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(role: string) {
    setBusy(true);
    try {
      await api(`/admin/roles/${role}/permissions`, { method: 'PUT', body: { permissions: draft } });
      toast.show(t('admin.saved'));
      setEditing(null);
      await load();
    } catch (e) {
      setError(fromApi(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequirePermission permission="roles.view">
      <h1 className="text-2xl font-bold">{t('admin.rolesTitle')}</h1>
      <p className="mb-5 mt-1 text-fg-muted">{t('admin.rolesText')}</p>
      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
      {!roles ? <Skeleton className="h-64 w-full" /> : null}
      <div className="space-y-3">
        {roles
          ?.filter((r) => r.isStaff || r.permissions.length)
          .map((role) => (
            <section key={role.key} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold">{t(`roles.${role.key}`)}</h2>
                  <p className="text-sm text-fg-muted">
                    {t('admin.members', { count: role.userCount })} · {role.key === 'super_admin' ? t('admin.allPermissions') : t('admin.permissionCount', { count: role.permissions.length })}
                  </p>
                </div>
                {role.key !== 'super_admin' && can('roles.manage') && editing !== role.key ? (
                  <Button variant="outline" size="sm" onClick={() => (setEditing(role.key), setDraft(role.permissions))}>
                    {t('admin.edit')}
                  </Button>
                ) : null}
              </div>
              {editing === role.key ? (
                <div className="mt-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {catalogue.map((p) => (
                      <Checkbox
                        key={p.key}
                        label={<span><code className="text-xs text-fg-subtle">{p.key}</code> <span className="block">{p.description}</span></span>}
                        checked={draft.includes(p.key)}
                        onChange={(e) => setDraft((d) => (e.target.checked ? [...d, p.key] : d.filter((k) => k !== p.key)))}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button loading={busy} onClick={() => save(role.key)}>{t('admin.save')}</Button>
                    <Button variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
                  </div>
                </div>
              ) : role.key !== 'super_admin' ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {role.permissions.map((p) => (
                    <li key={p}><Badge>{p}</Badge></li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
      </div>
    </RequirePermission>
  );
}
