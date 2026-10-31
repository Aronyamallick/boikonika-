'use client';

import { BellRing, Lock, Smartphone } from 'lucide-react';
import type { NotificationChannel, NotificationType } from '@boikonika/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, ApiError, apiRequest } from '@/lib/api/client';
import { useFormErrors } from '@/lib/forms/errors';
import { currentPushSubscription, disablePush, enablePush, pushSupported, type NotificationPreferences } from '@/lib/notifications';

const CHANNELS: NotificationChannel[] = ['in_app', 'push', 'email', 'sms'];

/** Which notices arrive where (in the app, as push, by email or SMS), and push on this device. */
export function NotificationSettings() {
  const t = useTranslations('notifications');
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [failed, setFailed] = useState(false);
  const [devicePush, setDevicePush] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<NotificationPreferences>('/me/notification-preferences').then(setPrefs, () => setFailed(true));
    currentPushSubscription().then((s) => setDevicePush(!!s), () => setDevicePush(false));
  }, []);

  const toggle = async (type: NotificationType, channel: NotificationChannel, enabled: boolean) => {
    const before = prefs;
    setPrefs((p) => (p ? { ...p, types: p.types.map((x) => (x.type === type ? { ...x, channels: x.channels.map((c) => (c.channel === channel ? { ...c, enabled } : c)) } : x)) } : p));
    try {
      const res = await apiRequest<NotificationPreferences>('/me/notification-preferences', { method: 'PUT', body: { preferences: [{ type, channel, enabled }] } });
      setPrefs(res.data);
    } catch (err) {
      setPrefs(before);
      toast.show(fromApi(err).message, 'danger');
    }
  };

  const switchPush = async () => {
    setBusy(true);
    try {
      if (devicePush) {
        await disablePush();
        setDevicePush(false);
        toast.show(t('pushOff'), 'success');
      } else if (await enablePush()) {
        setDevicePush(true);
        toast.show(t('pushOn'), 'success');
      } else {
        toast.show(t('pushDenied'), 'danger');
      }
    } catch (err) {
      // The browser itself refused (private window, no push service); API errors carry their own message.
      toast.show(err instanceof ApiError ? fromApi(err).message : t('pushFailed'), 'danger');
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    try {
      const res = await apiRequest('/me/push-subscriptions/test', { method: 'POST' });
      toast.show(res.message, 'success');
    } catch (err) {
      toast.show(fromApi(err).message, 'danger');
    }
  };

  if (failed && !prefs) return <ErrorState title={t('loadError')} />;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('settingsTitle')}</h1>
        <p className="mt-1 max-w-2xl text-fg-muted">{t('settingsIntro')}</p>
      </header>

      <section aria-labelledby="push-device" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="push-device" className="flex items-center gap-2 font-bold text-fg">
          <Smartphone className="h-5 w-5 text-primary" aria-hidden="true" />
          {t('deviceTitle')}
        </h2>
        {prefs && !prefs.pushAvailable ? (
          <p className="mt-2 text-sm text-fg-muted">{t('pushNotConfigured')}</p>
        ) : !pushSupported() ? (
          <p className="mt-2 text-sm text-fg-muted">{t('pushUnsupported')}</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-fg-muted">{devicePush ? t('deviceOn') : t('deviceOff')}</p>
            <Button size="sm" variant={devicePush ? 'outline' : 'primary'} loading={busy} disabled={devicePush === null} onClick={switchPush}>
              <BellRing className="h-4 w-4" aria-hidden="true" />
              {devicePush ? t('turnOffHere') : t('turnOnHere')}
            </Button>
            {devicePush ? (
              <Button size="sm" variant="ghost" onClick={test}>
                {t('sendTest')}
              </Button>
            ) : null}
          </div>
        )}
      </section>

      {!prefs ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <section aria-labelledby="prefs-table" className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          <h2 id="prefs-table" className="sr-only">
            {t('settingsTitle')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-subtle text-left text-xs uppercase tracking-wide text-fg-subtle">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">
                    {t('typeColumn')}
                  </th>
                  {CHANNELS.map((c) => (
                    <th key={c} scope="col" className="px-3 py-3 text-center font-bold">
                      {t(`channels.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {prefs.types.map((row) => (
                  <tr key={row.type}>
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <span className="flex items-center gap-1.5 font-semibold text-fg">
                        {t(`types.${row.type}`)}
                        {row.mandatory ? <Lock className="h-3.5 w-3.5 text-fg-subtle" aria-label={t('mandatory')} /> : null}
                      </span>
                      <span className="text-xs text-fg-muted">{t(`typeHints.${row.type}`)}</span>
                    </th>
                    {CHANNELS.map((channel) => {
                      const cell = row.channels.find((c) => c.channel === channel);
                      return (
                        <td key={channel} className="px-3 py-3 text-center">
                          {cell ? (
                            <input
                              type="checkbox"
                              className="h-5 w-5 cursor-pointer rounded border-line-input accent-[var(--bk-primary)] disabled:cursor-not-allowed"
                              checked={cell.enabled}
                              disabled={row.mandatory}
                              aria-label={t('toggleLabel', { type: t(`types.${row.type}`), channel: t(`channels.${channel}`) })}
                              onChange={(e) => toggle(row.type, channel, e.target.checked)}
                            />
                          ) : (
                            <span className="text-fg-subtle" aria-label={t('notOffered')}>
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <Alert tone="info">{t('wellbeing')}</Alert>
    </div>
  );
}
