'use client';

import { REPORT_REASONS, type ReportTargetType } from '@boikonika/shared';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { apiRequest } from '@/lib/api/client';
import { useFormErrors } from '@/lib/forms/errors';

/** Report anything reportable (post, comment, review, user…) with a reason and optional details. */
export function ReportDialog({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: ReportTargetType; targetId: string }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const name = useId();
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) {
      setError(t('validation.invalidChoice'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await apiRequest('/reports', { method: 'POST', body: { targetType, targetId, reason, details: details.trim() || undefined } });
      toast.show(res.message, 'success');
      setReason('');
      setDetails('');
      onClose();
    } catch (err) {
      setError(fromApi(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('report.title')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={busy} onClick={submit}>
            {t('report.submit')}
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-fg-muted">{t('report.why')}</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm hover:bg-subtle has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
            <input type="radio" name={name} value={r} checked={reason === r} onChange={() => setReason(r)} className="mt-0.5 accent-[var(--bk-primary)]" />
            <span>
              <span className="block font-semibold text-fg">{t(`report.reasons.${r}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field label={t('report.details')} hint={t('report.detailsHint')} error={error} className="mt-4">
        {(p) => <Textarea {...p} value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={2000} />}
      </Field>
    </Dialog>
  );
}
