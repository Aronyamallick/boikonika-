'use client';

import { SETTINGS_CATALOG } from '@boikonika/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, apiRequest } from '@/lib/api/client';
import type { FieldErrors } from '@/lib/forms/errors';
import { useFormErrors } from '@/lib/forms/errors';

type Key = keyof typeof SETTINGS_CATALOG;
interface Setting {
  key: Key;
  type: 'number' | 'boolean';
  group: string;
  default: number | boolean;
  min?: number;
  max?: number;
  step?: number;
  value: number | boolean;
  updatedAt: string | null;
}

/** Platform rules staff may tune without a deploy; each change is validated and recorded in the audit log. */
export default function AdminSettingsPage() {
  const t = useTranslations('adminSettings');
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const apply = (list: Setting[]) => (setSettings(list), setDraft(Object.fromEntries(list.map((s) => [s.key, typeof s.value === 'boolean' ? s.value : String(s.value)]))));
  useEffect(() => {
    api<Setting[]>('/admin/settings').then(apply, () => setFailed(true));
  }, []);

  const groups = useMemo(() => {
    const out = new Map<string, Setting[]>();
    for (const s of settings ?? []) out.set(s.group, [...(out.get(s.group) ?? []), s]);
    return [...out.entries()];
  }, [settings]);

  const changes = useMemo(() => {
    const out: Record<string, number | boolean> = {};
    for (const s of settings ?? []) {
      const v = draft[s.key];
      const next = s.type === 'boolean' ? v === true : Number(v);
      if (next !== s.value) out[s.key] = next;
    }
    return out;
  }, [settings, draft]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const res = await apiRequest<Setting[]>('/admin/settings', { method: 'PUT', body: { values: changes } });
      apply(res.data);
      toast.show(res.message, 'success');
    } catch (err) {
      const parsed = fromApi(err);
      // Field errors arrive as values.<key>; show them under that setting.
      setErrors(Object.fromEntries(Object.entries(parsed.fields).map(([k, v]) => [k.replace(/^values\./, ''), v])));
      if (!Object.keys(parsed.fields).length) toast.show(parsed.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <ErrorState title={t('error')} />;
  if (!settings) return <Skeleton className="h-96 w-full" />;
  const dirty = Object.keys(changes).length > 0;

  return (
    <RequirePermission permission="settings.manage">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mb-5 mt-1 text-fg-muted">{t('text')}</p>
      <form onSubmit={save} className="space-y-5" noValidate>
        {groups.map(([group, list]) => (
          <fieldset key={group} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <legend className="px-1 text-base font-bold">{t(`groups.${group}`)}</legend>
            <div className="mt-2 grid gap-5 md:grid-cols-2">
              {list.map((s) => {
                const hint = [t(`hints.${s.key.replace('.', '_')}`), s.type === 'number' ? t('range', { min: s.min ?? 0, max: s.max ?? 0, default: String(s.default) }) : null, s.updatedAt ? t('updated', { date: format.dateTime(new Date(s.updatedAt), { dateStyle: 'medium' }) }) : null]
                  .filter(Boolean)
                  .join(' · ');
                return s.type === 'boolean' ? (
                  <div key={s.key} className="space-y-1">
                    <Checkbox label={t(`labels.${s.key.replace('.', '_')}`)} checked={draft[s.key] === true} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.checked }))} />
                    <p className="pl-7 text-sm text-fg-subtle">{hint}</p>
                    {errors[s.key] ? <p className="pl-7 text-sm text-danger" role="alert">{errors[s.key]}</p> : null}
                  </div>
                ) : (
                  <Field key={s.key} label={t(`labels.${s.key.replace('.', '_')}`)} hint={hint} error={errors[s.key]}>
                    {(p) => <Input {...p} type="number" inputMode="decimal" min={s.min} max={s.max} step={s.step ?? 1} value={String(draft[s.key] ?? '')} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} className="max-w-48" />}
                  </Field>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
          <p className="mr-auto text-sm text-fg-muted" aria-live="polite">
            {dirty ? t('unsaved', { count: Object.keys(changes).length }) : t('saved')}
          </p>
          <Button type="button" variant="outline" disabled={!dirty || busy} onClick={() => settings && apply(settings)}>
            {t('reset')}
          </Button>
          <Button type="submit" loading={busy} disabled={!dirty}>
            {t('save')}
          </Button>
        </div>
      </form>
    </RequirePermission>
  );
}
