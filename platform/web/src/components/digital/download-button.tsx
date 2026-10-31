'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { saveFrom, type DownloadLink } from '@/lib/digital';
import { useFormErrors } from '@/lib/forms/errors';

/** Asks for a fresh, short-lived link to an e-book I'm entitled to and starts the download. */
export function DownloadButton({ bookId, title, size = 'md', variant = 'primary', className, onDone }: { bookId: string; title: string; size?: ButtonSize; variant?: ButtonVariant; className?: string; onDone?: () => void }) {
  const t = useTranslations('digital');
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const link = await api<DownloadLink>(`/me/library/${bookId}/download`, { method: 'POST' });
      saveFrom(link.url);
      toast.show(t('downloadStarted', { file: link.fileName }), 'success');
      onDone?.();
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size={size} variant={variant} loading={busy} onClick={run} className={className} aria-label={t('downloadTitle', { title })}>
      <Download className="h-4 w-4" aria-hidden="true" />
      {t('download')}
    </Button>
  );
}
