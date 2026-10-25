'use client';

import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AddressForm, AddressLines } from '@/components/commerce/address-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import type { Address } from '@/lib/commerce';
import { useFormErrors } from '@/lib/forms/errors';

export function AddressesView() {
  const t = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Address[]>('/me/addresses').then(setAddresses, () => setAddresses([]));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="container-page max-w-3xl py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('addresses.title')}</h1>
          <p className="mt-1 text-fg-muted">{t('addresses.text')}</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('addresses.add')}
        </Button>
      </header>
      <div className="mt-6">
        {addresses === null ? (
          <Skeleton className="h-32 w-full" />
        ) : addresses.length === 0 ? (
          <EmptyState icon={<MapPin className="h-6 w-6" />} title={t('addresses.empty')} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-sm">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-fg-subtle">
                  {t(`addresses.labels.${a.label}`)}
                  {a.isDefault ? <Badge tone="primary">{t('addresses.default')}</Badge> : null}
                </p>
                <AddressLines address={a} locale={locale} />
                <div className="mt-auto flex gap-2 pt-4">
                  <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    {t('common.edit')}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(a)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {t('addresses.delete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t('addresses.add') : t('addresses.edit')} closeLabel={t('common.close')} className="w-[min(94vw,640px)]">
        {editing !== null ? (
          <AddressForm
            address={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              toast.show(t('addresses.saved'), 'success');
              load();
            }}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('addresses.confirmDelete')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                if (!deleting) return;
                setBusy(true);
                try {
                  await api(`/me/addresses/${deleting.id}`, { method: 'DELETE' });
                  toast.show(t('addresses.deleted'), 'success');
                  setDeleting(null);
                  load();
                } catch (e) {
                  toast.show(fromApi(e).message, 'danger');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('addresses.delete')}
            </Button>
          </>
        }
      >
        {deleting ? <AddressLines address={deleting} locale={locale} /> : null}
      </Dialog>
    </div>
  );
}
