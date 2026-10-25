'use client';

import { CheckCircle2, Copyright, ShieldAlert } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Badge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface Standing {
  actions: Array<{ id: string; action: string; reason: string; targetType: string; expiresAt: string | null; revertedAt: string | null; createdAt: string }>;
  restrictions: Array<{ scope: string; reason: string | null; until: string | null; since: string }>;
  copyright: Array<{ id: string; reference: string; status: string; rightsHolder: string; workDescription: string; title: string; adminNote: string | null; canCounter: boolean; counterSubmittedAt: string | null; createdAt: string }>;
}
const CLAIM_TONE: Record<string, Tone> = { submitted: 'info', under_review: 'warning', content_removed: 'danger', counter_noticed: 'accent', restored: 'success', rejected: 'neutral' };

/** What moderators decided about my account and content, and complaints I can answer. */
export function StandingView() {
  const t = useTranslations('standing');
  const tm = useTranslations('adminModeration');
  const tcr = useTranslations('adminCopyright');
  const tc = useTranslations('common');
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [data, setData] = useState<Standing | null>(null);
  const [failed, setFailed] = useState(false);
  const [answering, setAnswering] = useState<Standing['copyright'][number] | null>(null);
  const [statement, setStatement] = useState('');
  const [signature, setSignature] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api<Standing>('/me/standing').then(setData, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const sendCounter = async () => {
    if (!answering) return;
    setBusy(true);
    setErrors({});
    try {
      const res = await apiRequest(`/me/copyright-claims/${answering.id}/counter`, { method: 'POST', body: { statement, signature, consent } });
      toast.show(res.message, 'success');
      setAnswering(null);
      load();
    } catch (e) {
      const parsed = fromApi(e);
      setErrors(parsed.fields);
      if (!Object.keys(parsed.fields).length) toast.show(parsed.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <ErrorState title={t('error')} retryLabel={tc('retry')} onRetry={load} />;
  if (!data) return <Skeleton className="h-64 w-full" />;
  const date = (d: string) => format.dateTime(new Date(d), { dateStyle: 'medium' });
  const live = data.actions.filter((a) => !a.revertedAt);
  const clear = !data.restrictions.length && !live.some((a) => a.action !== 'no_action');

  return (
    <>
      <section aria-labelledby="st-status" className={clear ? 'flex items-start gap-3 rounded-xl bg-success-soft p-5 text-success-soft-fg' : 'flex items-start gap-3 rounded-xl bg-warning-soft p-5 text-warning-soft-fg'}>
        {clear ? <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" /> : <ShieldAlert className="h-6 w-6 shrink-0" aria-hidden="true" />}
        <div>
          <h2 id="st-status" className="font-bold">
            {clear ? t('goodTitle') : t('noticeTitle')}
          </h2>
          <p className="mt-0.5 text-sm">{clear ? t('goodText') : t('noticeText')}</p>
          {data.restrictions.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {data.restrictions.map((r, i) => (
                <li key={i}>• {t('restriction', { scope: tm(`scopes.${r.scope}`), until: r.until ? date(r.until) : t('noEnd') })}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="st-history" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="st-history" className="mb-3 font-bold">
          {t('historyTitle')}
        </h2>
        {data.actions.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('noHistory')}</p>
        ) : (
          <ol className="divide-y divide-line text-sm">
            {data.actions.map((a) => (
              <li key={a.id} className="py-3">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                  {tm(`actions.${a.action}`)}
                  <span className="font-normal text-fg-muted">· {tm(`types.${a.targetType}`)}</span>
                  {a.revertedAt ? <Badge tone="success">{t('reverted')}</Badge> : null}
                </p>
                <p className="mt-0.5 text-fg-muted">{a.reason}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  {date(a.createdAt)}
                  {a.expiresAt && !a.revertedAt ? ` · ${t('until', { date: date(a.expiresAt) })}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-fg-subtle">{t('appeal')}</p>
      </section>

      <section aria-labelledby="st-copyright" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="st-copyright" className="mb-3 flex items-center gap-2 font-bold">
          <Copyright className="h-5 w-5 text-fg-muted" aria-hidden="true" />
          {t('copyrightTitle')}
        </h2>
        {data.copyright.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('noClaims')}</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {data.copyright.map((c) => (
              <li key={c.id} className="rounded-lg border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-fg-subtle">
                      {tcr('reference', { ref: c.reference })} · {date(c.createdAt)}
                    </p>
                    <p className="font-semibold text-fg">{c.title}</p>
                  </div>
                  <Badge tone={CLAIM_TONE[c.status] ?? 'neutral'}>{tcr(`statuses.${c.status}`)}</Badge>
                </div>
                <p className="mt-2 text-fg-muted">{t('claimBy', { holder: c.rightsHolder })}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-fg">{c.workDescription}</p>
                {c.adminNote ? <p className="mt-2 rounded-lg bg-subtle p-2.5 text-xs text-fg">{t('staffNote', { note: c.adminNote })}</p> : null}
                {c.counterSubmittedAt ? <p className="mt-2 text-xs text-fg-subtle">{t('counterSent', { date: date(c.counterSubmittedAt) })}</p> : null}
                {c.canCounter ? (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => (setAnswering(c), setStatement(''), setSignature(''), setConsent(false), setErrors({}))}>
                    {t('counter')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={!!answering}
        onClose={() => setAnswering(null)}
        title={t('counterTitle', { title: answering?.title ?? '' })}
        closeLabel={tc('close')}
        footer={
          <>
            <Button variant="outline" onClick={() => setAnswering(null)}>
              {tc('cancel')}
            </Button>
            <Button loading={busy} onClick={sendCounter}>
              {t('counterSend')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">{t('counterText')}</p>
          <Field label={t('statement')} hint={t('statementHint')} error={errors.statement} required>
            {(p) => <Textarea {...p} value={statement} onChange={(e) => setStatement(e.target.value)} rows={6} maxLength={3000} />}
          </Field>
          <Field label={t('signature')} error={errors.signature} required>
            {(p) => <Input {...p} value={signature} onChange={(e) => setSignature(e.target.value)} maxLength={160} />}
          </Field>
          <Checkbox label={t('consent')} checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={errors.consent ? true : undefined} />
          {errors.consent ? <p className="pl-7 text-sm text-danger" role="alert">{errors.consent}</p> : null}
        </div>
      </Dialog>
    </>
  );
}
