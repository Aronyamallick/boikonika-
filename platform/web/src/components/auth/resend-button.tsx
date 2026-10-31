'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/** "Resend code" with a visible countdown matching the server's cooldown. */
export function ResendButton({ seconds, onResend }: { seconds: number; onResend: () => Promise<number | void> }) {
  const t = useTranslations('auth');
  const [left, setLeft] = useState(seconds);
  const [busy, setBusy] = useState(false);

  useEffect(() => setLeft(seconds), [seconds]);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  return (
    <Button
      variant="link"
      disabled={left > 0 || busy}
      onClick={async () => {
        setBusy(true);
        try {
          const next = await onResend();
          setLeft(typeof next === 'number' ? next : seconds);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span aria-live="polite">{left > 0 ? t('otpResendIn', { seconds: left }) : t('otpResend')}</span>
    </Button>
  );
}
