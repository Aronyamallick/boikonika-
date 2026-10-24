'use client';

import { normalizeOtp, parseContact, passwordError, type AuthUser, type OtpSentResult } from '@boikonika/shared';
import { CheckCircle2, Laptop, Mail, Phone, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { CodeInput } from '@/components/auth/code-input';
import { PasswordInput } from '@/components/auth/password-input';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api, apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface SessionItem {
  id: string;
  deviceName: string | null;
  platform: string;
  ip: string | null;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}
interface LoginItem {
  id: string;
  result: 'success' | 'failed_password' | 'failed_2fa' | 'blocked' | 'locked';
  method: string;
  ip: string | null;
  userAgent: string | null;
  suspicious: boolean;
  createdAt: string;
}

function Section({ title, description, icon, children }: { title: string; description: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby={`${title}-heading`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 id={`${title}-heading`} className="text-lg font-bold text-fg">
            {title}
          </h2>
          <p className="text-sm text-fg-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function SecurityView() {
  const t = useTranslations();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="container-page max-w-3xl space-y-6 py-8 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t('security.title')}</h1>
        <p className="mt-1 text-fg-muted">{t('security.subtitle')}</p>
      </header>
      <ContactsSection user={user} />
      <PasswordSection user={user} />
      <TwoFactorSection user={user} />
      <DevicesSection />
      <HistorySection />
    </div>
  );
}

function useRunner() {
  const { fromApi } = useFormErrors();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const run = useCallback(
    async (task: () => Promise<void>) => {
      setBusy(true);
      setFormError('');
      try {
        await task();
      } catch (error) {
        const { fields, message } = fromApi(error);
        setErrors(fields);
        setFormError(Object.keys(fields).length ? '' : message);
      } finally {
        setBusy(false);
      }
    },
    [fromApi],
  );
  return { busy, errors, setErrors, formError, setFormError, run };
}

function ContactsSection({ user }: { user: AuthUser }) {
  const t = useTranslations();
  const toast = useToast();
  const { reload } = useAuth();
  const [editing, setEditing] = useState<'email' | 'phone' | null>(null);
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<OtpSentResult | null>(null);
  const { busy, errors, setErrors, formError, run } = useRunner();

  const reset = () => (setEditing(null), setValue(''), setCode(''), setSent(null), setErrors({}));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!sent) {
      if (parseContact(value)?.kind !== editing) return setErrors({ value: t(editing === 'email' ? 'validation.email' : 'validation.phone') });
      return void run(async () => setSent(await api<OtpSentResult>('/account/security/contact/request', { method: 'POST', body: { target: value } })));
    }
    if (!normalizeOtp(code)) return setErrors({ code: t('validation.otp') });
    void run(async () => {
      const { message } = await apiRequest('/account/security/contact/verify', { method: 'POST', body: { target: value, code } });
      await reload();
      toast.show(message);
      reset();
    });
  }

  const row = (kind: 'email' | 'phone', icon: ReactNode, current: string | null, verified: boolean) => (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="text-fg-subtle" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{kind === 'email' ? t('auth.email') : t('auth.phone')}</p>
        <p className="truncate text-sm text-fg-muted">{current ?? t('security.notAdded')}</p>
      </div>
      {current && verified ? <Badge tone="success">{t('security.verified')}</Badge> : null}
      <Button variant="outline" size="sm" onClick={() => (reset(), setEditing(kind))}>
        {current ? t('security.change') : kind === 'email' ? t('security.addEmail') : t('security.addPhone')}
      </Button>
    </li>
  );

  return (
    <Section title={t('security.contactsSection')} description={t('security.contactsText')} icon={<Mail className="h-5 w-5" />}>
      <ul className="divide-y divide-line">
        {row('email', <Mail className="h-5 w-5" />, user.email, user.emailVerified)}
        {row('phone', <Phone className="h-5 w-5" />, user.phone ? `0${user.phone.slice(4)}` : null, user.phoneVerified)}
      </ul>
      {editing ? (
        <form onSubmit={submit} noValidate className="mt-4 space-y-4 rounded-xl bg-subtle p-4">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <Field label={editing === 'email' ? t('auth.email') : t('auth.phone')} error={errors.value ?? errors.target} hint={editing === 'phone' ? t('auth.phoneHint') : undefined}>
            {(field) => <Input {...field} value={value} onChange={(e) => setValue(e.target.value)} readOnly={!!sent} type={editing === 'email' ? 'email' : 'tel'} autoComplete={editing === 'email' ? 'email' : 'tel'} autoFocus />}
          </Field>
          {sent ? (
            <Field label={t('auth.otpCode')} error={errors.code} hint={t('auth.codeSentTo', { target: sent.sentTo })}>
              {(field) => <CodeInput {...field} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />}
            </Field>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              {sent ? t('auth.verify') : t('auth.sendCode')}
            </Button>
            <Button variant="ghost" onClick={reset}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : null}
    </Section>
  );
}

function PasswordSection({ user }: { user: AuthUser }) {
  const t = useTranslations();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const { busy, errors, setErrors, formError, run } = useRunner();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (passwordError(next)) return setErrors({ newPassword: t('validation.passwordWeak') });
    void run(async () => {
      const { message } = await apiRequest('/account/security/password', { method: 'POST', body: { currentPassword: user.hasPassword ? current : undefined, newPassword: next, signOutOtherDevices: signOutOthers } });
      toast.show(message);
      setOpen(false);
      setCurrent('');
      setNext('');
    });
  }

  return (
    <Section title={t('security.passwordSection')} description={user.hasPassword ? t('security.passwordText') : t('security.setPasswordText')} icon={<ShieldCheck className="h-5 w-5" />}>
      {open ? (
        <form onSubmit={submit} noValidate className="space-y-4">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          {user.hasPassword ? (
            <Field label={t('security.currentPassword')} error={errors.currentPassword} required>
              {(field) => <PasswordInput {...field} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}
            </Field>
          ) : null}
          <Field label={t('auth.newPassword')} error={errors.newPassword} hint={t('auth.passwordHint')} required>
            {(field) => <PasswordInput {...field} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />}
          </Field>
          <Checkbox label={t('security.signOutOthers')} checked={signOutOthers} onChange={(e) => setSignOutOthers(e.target.checked)} />
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              {t('common.save')}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          {user.hasPassword ? t('security.changePassword') : t('security.setPassword')}
        </Button>
      )}
    </Section>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const text = codes.join('\n');
  return (
    <div className="space-y-4">
      <Alert tone="warning" title={t('security.recoveryTitle')}>
        {t('security.recoveryText')}
      </Alert>
      <ul className="grid grid-cols-2 gap-2 rounded-xl bg-subtle p-4 font-mono text-sm sm:grid-cols-3" aria-label={t('auth.recoveryCode')}>
        {codes.map((c) => (
          <li key={c} className="rounded-md bg-surface px-2 py-1.5 text-center text-fg">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(text).then(() => toast.show(t('common.copied')))}>
          {t('security.copyCodes')}
        </Button>
        <a
          className="inline-flex h-11 items-center rounded-lg border border-line-input bg-surface px-5 text-[15px] font-semibold text-fg hover:bg-subtle"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Boikonika recovery codes\n\n${text}\n`)}`}
          download="boikonika-recovery-codes.txt"
        >
          {t('security.downloadCodes')}
        </a>
        <Button onClick={onDone}>{t('security.savedCodes')}</Button>
      </div>
    </div>
  );
}

function TwoFactorSection({ user }: { user: AuthUser }) {
  const t = useTranslations();
  const toast = useToast();
  const { reload } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const { busy, errors, setErrors, formError, run } = useRunner();

  const start = () => run(async () => setSetup(await api<{ secret: string; qrSvg: string; otpauthUrl: string }>('/account/security/2fa/setup', { method: 'POST' })));

  function enable(e: FormEvent) {
    e.preventDefault();
    if (!normalizeOtp(code)) return setErrors({ code: t('validation.otp') });
    void run(async () => {
      const result = await api<{ recoveryCodes: string[] }>('/account/security/2fa/enable', { method: 'POST', body: { code } });
      setCodes(result.recoveryCodes);
      setSetup(null);
      setCode('');
      await reload();
    });
  }

  function disable(e: FormEvent) {
    e.preventDefault();
    if (!normalizeOtp(code)) return setErrors({ code: t('validation.otp') });
    void run(async () => {
      await api('/account/security/2fa/disable', { method: 'POST', body: { password: user.hasPassword ? password : undefined, code } });
      toast.show(t('security.twoFactorDisabled'));
      setDisabling(false);
      setCode('');
      setPassword('');
      await reload();
    });
  }

  function regenerate(e: FormEvent) {
    e.preventDefault();
    if (!normalizeOtp(code)) return setErrors({ code: t('validation.otp') });
    void run(async () => {
      setCodes((await api<{ recoveryCodes: string[] }>('/account/security/2fa/recovery-codes', { method: 'POST', body: { code } })).recoveryCodes);
      setCode('');
    });
  }

  const status = (
    <Badge tone={user.twoFactorEnabled ? 'success' : 'neutral'}>{user.twoFactorEnabled ? t('security.on') : t('security.off')}</Badge>
  );

  return (
    <Section title={t('security.twoFactorSection')} description={t('security.twoFactorText')} icon={user.twoFactorEnabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}>
      <div className="mb-4">{status}</div>
      {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}
      {codes ? (
        <RecoveryCodes codes={codes} onDone={() => (setCodes(null), toast.show(t('security.twoFactorEnabled')))} />
      ) : setup ? (
        <form onSubmit={enable} noValidate className="space-y-4">
          <p className="text-sm text-fg-muted">{t('security.scanQr')}</p>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL from our API, no optimisation needed */}
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qrSvg)}`} alt={t('security.scanQr')} className="h-44 w-44 shrink-0 rounded-xl border border-line bg-white p-2" />
            <div className="min-w-0 space-y-2 text-sm">
              <p className="text-fg-muted">{t('security.manualKey')}</p>
              <code className="block break-all rounded-lg bg-subtle px-3 py-2 font-mono text-fg">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            </div>
          </div>
          <Field label={t('security.enterAppCode')} error={errors.code}>
            {(field) => <CodeInput {...field} value={code} onChange={(e) => setCode(e.target.value)} />}
          </Field>
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              {t('security.turnOn')}
            </Button>
            <Button variant="ghost" onClick={() => setSetup(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : user.twoFactorEnabled ? (
        disabling ? (
          <form onSubmit={disable} noValidate className="space-y-4">
            <p className="text-sm text-fg-muted">{t('security.disableText')}</p>
            {user.hasPassword ? (
              <Field label={t('auth.password')} error={errors.password}>
                {(field) => <PasswordInput {...field} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
              </Field>
            ) : null}
            <Field label={t('auth.authCode')} error={errors.code}>
              {(field) => <CodeInput {...field} value={code} onChange={(e) => setCode(e.target.value)} />}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="danger" loading={busy}>
                {t('security.turnOff')}
              </Button>
              <Button variant="ghost" onClick={() => setDisabling(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <form onSubmit={regenerate} noValidate className="flex flex-wrap items-end gap-2">
              <Field label={t('auth.authCode')} error={errors.code} className="w-44">
                {(field) => <CodeInput {...field} value={code} onChange={(e) => setCode(e.target.value)} className="text-lg" />}
              </Field>
              <Button type="submit" variant="outline" loading={busy}>
                {t('security.newCodes')}
              </Button>
            </form>
            <Button variant="danger" onClick={() => (setDisabling(true), setCode(''), setErrors({}))}>
              {t('security.turnOff')}
            </Button>
          </div>
        )
      ) : (
        <Button onClick={start} loading={busy}>
          {t('security.turnOn')}
        </Button>
      )}
    </Section>
  );
}

function DevicesSection() {
  const t = useTranslations();
  const format = useFormatter();
  // Relative times ("5 minutes ago") are computed against a clock that ticks every minute.
  const now = useNow({ updateInterval: 60_000 });
  const toast = useToast();
  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [error, setError] = useState('');
  const { busy, run } = useRunner();

  const load = useCallback(() => {
    api<SessionItem[]>('/account/security/sessions').then(setItems, () => setError(t('errors.generic')));
  }, [t]);
  useEffect(load, [load]);

  const others = items?.filter((s) => !s.current) ?? [];
  return (
    <Section title={t('security.devicesSection')} description={t('security.devicesText')} icon={<Laptop className="h-5 w-5" />}>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!items && !error ? <Skeleton className="h-24 w-full" /> : null}
      {items ? (
        <>
          <ul className="divide-y divide-line">
            {items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="text-fg-subtle" aria-hidden="true">
                  {s.platform === 'web' ? <Laptop className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                    {s.deviceName ?? s.platform}
                    {s.current ? <Badge tone="primary">{t('security.thisDevice')}</Badge> : null}
                  </p>
                  <p className="text-xs text-fg-subtle">
                    {t('security.lastActive', { time: format.relativeTime(new Date(s.lastUsedAt), now) })}
                    {s.ip ? ` · ${s.ip}` : ''}
                  </p>
                </div>
                {!s.current ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api(`/account/security/sessions/${s.id}`, { method: 'DELETE' });
                        toast.show(t('security.deviceSignedOut'));
                        load();
                      })
                    }
                  >
                    {t('security.signOut')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {others.length ? (
            <Button
              className="mt-3"
              variant="outline"
              loading={busy}
              onClick={() =>
                run(async () => {
                  const res = await api<{ revoked: number }>('/account/security/logout-all', { method: 'POST', body: { keepCurrent: true } });
                  toast.show(t('security.othersSignedOut', { count: res.revoked }));
                  load();
                })
              }
            >
              {t('security.signOutAllOthers')}
            </Button>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-sm text-fg-muted">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              {t('security.noOtherDevices')}
            </p>
          )}
        </>
      ) : null}
    </Section>
  );
}

function HistorySection() {
  const t = useTranslations();
  const format = useFormatter();
  const [items, setItems] = useState<LoginItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<LoginItem[]>('/account/security/login-history').then(setItems, () => setError(t('errors.generic')));
  }, [t]);

  const methodLabel = (m: string) => (t.has(`security.method_${m}`) ? t(`security.method_${m}`) : m);
  return (
    <Section title={t('security.historySection')} description={t('security.historyText')} icon={<ShieldCheck className="h-5 w-5" />}>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!items && !error ? <Skeleton className="h-24 w-full" /> : null}
      {items ? (
        <ul className="divide-y divide-line">
          {items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <Badge tone={e.result === 'success' ? (e.suspicious ? 'warning' : 'success') : 'danger'}>{t(`security.result_${e.result}`)}</Badge>
                <span className="text-fg-muted">{methodLabel(e.method)}</span>
                {e.suspicious ? <span className="font-semibold text-warning-soft-fg">{t('security.unusual')}</span> : null}
              </span>
              <span className="text-xs text-fg-subtle">
                {format.dateTime(new Date(e.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                {e.ip ? ` · ${e.ip}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}
