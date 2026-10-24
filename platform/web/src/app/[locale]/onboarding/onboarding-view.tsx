'use client';

import { INTEREST_KEYS, ONBOARDING_MIN_INTERESTS, type InterestKey } from '@boikonika/shared';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { safeNextPath } from '@/lib/device';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/forms/errors';

/** Pick reading interests (at least three) to personalise discovery; can be revisited any time. */
export function OnboardingView() {
  const t = useTranslations();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const { reload } = useAuth();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [selected, setSelected] = useState<InterestKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ interests: InterestKey[] }>('/me/profile').then((p) => setSelected(p.interests), () => undefined);
  }, []);

  const toggle = (key: InterestKey) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  const enough = selected.length >= ONBOARDING_MIN_INTERESTS;

  async function finish() {
    setBusy(true);
    setError('');
    try {
      await api('/me/interests', { method: 'PUT', body: { interests: selected } });
      await reload();
      toast.show(t('onboarding.saved'));
      router.replace(next);
    } catch (e) {
      setError(fromApi(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('onboarding.title')}</h1>
      <p className="mt-2 text-fg-muted">{t('onboarding.subtitle')}</p>
      {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
      <ul className="mt-6 flex flex-wrap gap-2.5" aria-label={t('onboarding.title')}>
        {INTEREST_KEYS.map((key) => {
          const active = selected.includes(key);
          return (
            <li key={key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => toggle(key)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active ? 'border-primary bg-primary text-primary-fg' : 'border-line-input bg-surface text-fg hover:bg-subtle',
                )}
              >
                {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                {t(`interests.${key}`)}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-16 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-md md:bottom-4">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {enough ? t('onboarding.selected', { count: selected.length }) : t('onboarding.pickAtLeast', { count: ONBOARDING_MIN_INTERESTS })}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.replace(next)}>
            {t('onboarding.skip')}
          </Button>
          <Button onClick={finish} disabled={!enough} loading={busy}>
            {t('onboarding.finish')}
          </Button>
        </div>
      </div>
    </div>
  );
}
