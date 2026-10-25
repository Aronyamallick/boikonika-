'use client';

import { formatMoney } from '@boikonika/shared';
import { Plus, TicketPercent } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminPager } from '@/components/admin/admin-pager';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed' | 'free_shipping';
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string | null;
  usageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  description: string | null;
}

const blank = { code: '', type: 'percent', value: '', minOrderAmount: '0', maxDiscountAmount: '', usageLimit: '', perUserLimit: '1', startsAt: '', endsAt: '', isActive: true, description: '' };
/** <input type="datetime-local"> value in the browser's time zone. */
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');

export default function AdminCouponsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [rows, setRows] = useState<Coupon[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiRequest<Coupon[]>('/admin/coupons', { query: { page, pageSize: 25 } }).then(
      (res) => (setRows(res.data), setTotal(res.meta?.total ?? 0)),
      () => setRows([]),
    );
  }, [page]);
  useEffect(load, [load]);

  const open = (c: Coupon | 'new') => {
    setEditing(c);
    setErrors({});
    setForm(
      c === 'new'
        ? blank
        : { code: c.code, type: c.type, value: c.value, minOrderAmount: c.minOrderAmount, maxDiscountAmount: c.maxDiscountAmount ?? '', usageLimit: c.usageLimit?.toString() ?? '', perUserLimit: String(c.perUserLimit), startsAt: toLocalInput(c.startsAt), endsAt: toLocalInput(c.endsAt), isActive: c.isActive, description: c.description ?? '' },
    );
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const body = {
      code: form.code,
      type: form.type,
      value: form.type === 'free_shipping' ? '0' : form.value,
      minOrderAmount: form.minOrderAmount || '0',
      maxDiscountAmount: form.maxDiscountAmount || undefined,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
      perUserLimit: Number(form.perUserLimit || 1),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      isActive: form.isActive,
      description: form.description || undefined,
    };
    try {
      const res = await apiRequest(editing === 'new' ? '/admin/coupons' : `/admin/coupons/${(editing as Coupon).id}`, { method: editing === 'new' ? 'POST' : 'PATCH', body });
      toast.show(res.message, 'success');
      setEditing(null);
      load();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(Object.keys(fields).length ? fields : { code: message });
    } finally {
      setBusy(false);
    }
  };

  const valueLabel = (c: Coupon) => (c.type === 'percent' ? `${format.number(Number(c.value))}%` : c.type === 'fixed' ? formatMoney(c.value, locale, { hideZeroDecimals: true }) : t('adminCoupons.types.free_shipping'));
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <RequirePermission permission="coupons.manage">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('adminCoupons.title')}</h1>
        <Button onClick={() => open('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('adminCoupons.create')}
        </Button>
      </div>
      {!rows ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<TicketPercent className="h-6 w-6" />} title={t('adminCoupons.empty')} />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-4 p-4 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-mono font-bold text-fg">{c.code}</span> · {valueLabel(c)}
                <span className="block text-fg-muted">
                  {c.usageLimit ? t('adminCoupons.usedOf', { used: c.usedCount, limit: c.usageLimit }) : t('adminCoupons.used', { used: c.usedCount })}
                  {Number(c.minOrderAmount) > 0 ? ` · ${t('adminCoupons.minOrder')} ${formatMoney(c.minOrderAmount, locale, { hideZeroDecimals: true })}` : ''}
                  {c.endsAt ? ` · ${t('adminCoupons.endsAt')} ${format.dateTime(new Date(c.endsAt), { dateStyle: 'medium' })}` : ''}
                </span>
              </span>
              <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? t('adminCoupons.active') : t('adminCoupons.inactive')}</Badge>
              <Button size="sm" variant="outline" onClick={() => open(c)}>
                {t('common.edit')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <AdminPager page={page} total={total} pageSize={25} onPage={setPage} />
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('adminCoupons.create') : t('adminCoupons.edit')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="coupon-form" loading={busy}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="coupon-form" onSubmit={save} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('adminCoupons.code')} required error={errors.code}>
              {(p) => <Input {...p} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="font-mono uppercase" maxLength={40} />}
            </Field>
            <Field label={t('adminCoupons.type')} error={errors.type}>
              {(p) => (
                <Select {...p} value={form.type} onChange={set('type')}>
                  {(['percent', 'fixed', 'free_shipping'] as const).map((type) => (
                    <option key={type} value={type}>
                      {t(`adminCoupons.types.${type}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {form.type !== 'free_shipping' ? (
              <Field label={t('adminCoupons.value')} required error={errors.value}>
                {(p) => <Input {...p} value={form.value} onChange={set('value')} inputMode="decimal" />}
              </Field>
            ) : null}
            <Field label={t('adminCoupons.minOrder')} error={errors.minOrderAmount}>
              {(p) => <Input {...p} value={form.minOrderAmount} onChange={set('minOrderAmount')} inputMode="decimal" />}
            </Field>
            {form.type === 'percent' ? (
              <Field label={t('adminCoupons.maxDiscount')} error={errors.maxDiscountAmount}>
                {(p) => <Input {...p} value={form.maxDiscountAmount} onChange={set('maxDiscountAmount')} inputMode="decimal" />}
              </Field>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('adminCoupons.usageLimit')} error={errors.usageLimit}>
              {(p) => <Input {...p} value={form.usageLimit} onChange={set('usageLimit')} inputMode="numeric" />}
            </Field>
            <Field label={t('adminCoupons.perUser')} error={errors.perUserLimit}>
              {(p) => <Input {...p} value={form.perUserLimit} onChange={set('perUserLimit')} inputMode="numeric" />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('adminCoupons.startsAt')} error={errors.startsAt}>
              {(p) => <Input {...p} type="datetime-local" value={form.startsAt} onChange={set('startsAt')} />}
            </Field>
            <Field label={t('adminCoupons.endsAt')} error={errors.endsAt}>
              {(p) => <Input {...p} type="datetime-local" value={form.endsAt} onChange={set('endsAt')} />}
            </Field>
          </div>
          <Field label={t('adminCoupons.description')}>{(p) => <Input {...p} value={form.description} onChange={set('description')} maxLength={300} />}</Field>
          <Checkbox checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} label={t('adminCoupons.active')} />
        </form>
      </Dialog>
    </RequirePermission>
  );
}
