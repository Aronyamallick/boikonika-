'use client';

import { VISIBILITIES, type Visibility } from '@boikonika/shared';
import { Camera, Download, Eye, Settings2, Trash2, User } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { PasswordInput } from '@/components/auth/password-input';
import { applyTheme } from '@/components/layout/theme-toggle';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api, apiDownload, apiRequest } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface OwnProfile {
  displayName: string;
  username: string;
  locale: 'bn' | 'en';
  theme: 'light' | 'dark' | 'system';
  personalizationEnabled: boolean;
  avatarUrl: string | null;
  bio: string | null;
  education: string | null;
  institution: string | null;
  location: string | null;
  website: string | null;
  birthYear: number | null;
  profileVisibility: Visibility;
  readingStatsVisibility: Visibility;
  libraryVisibility: Visibility;
  activityVisibility: Visibility;
  interests: string[];
}

function Panel({ title, description, icon, children }: { title: string; description?: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-bold text-fg">{title}</h2>
          {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ProfileSettings() {
  const t = useTranslations();
  const { reload } = useAuth();
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<OwnProfile>('/me/profile').then(setProfile, () => setError(t('errors.generic')));
  }, [t]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!profile) return <Skeleton className="h-96 w-full" />;
  const saved = (next: OwnProfile) => {
    setProfile(next);
    void reload();
  };
  return (
    <div className="space-y-6">
      <PhotoPanel profile={profile} onChange={(avatarUrl) => (setProfile({ ...profile, avatarUrl }), void reload())} />
      <DetailsPanel profile={profile} onSaved={saved} />
      <PrivacyPanel profile={profile} onSaved={saved} />
      <PreferencesPanel profile={profile} onSaved={saved} />
      <Panel title={t('profileSettings.interests')} icon={<User className="h-5 w-5" />}>
        <p className="mb-3 text-sm text-fg-muted">{profile.interests.length ? profile.interests.map((i) => t(`interests.${i}`)).join(' · ') : t('onboarding.subtitle')}</p>
        <Link href="/onboarding?next=/account/profile" className="text-sm font-semibold text-primary hover:underline">
          {t('profileSettings.editInterests')}
        </Link>
      </Panel>
      <DataPanel />
      <DeletePanel />
    </div>
  );
}

function PhotoPanel({ profile, onChange }: { profile: OwnProfile; onChange: (url: string | null) => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api<{ url: string }>('/me/avatar', { method: 'PUT', body: form });
      onChange(res.url);
      toast.show(t('common.saved'));
    } catch (e) {
      setError(fromApi(e).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <Panel title={t('profileSettings.photo')} description={t('profileSettings.photoHint')} icon={<Camera className="h-5 w-5" />}>
      {error ? <Alert tone="danger" className="mb-3">{error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={profile.displayName} src={profile.avatarUrl} size="xl" />
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-file" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button onClick={() => input.current?.click()} loading={busy}>
            {t('profileSettings.uploadPhoto')}
          </Button>
          {profile.avatarUrl ? (
            <Button variant="ghost" disabled={busy} onClick={() => api('/me/avatar', { method: 'DELETE' }).then(() => onChange(null))}>
              {t('profileSettings.removePhoto')}
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function usePatch(onSaved: (p: OwnProfile) => void) {
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const save = async (body: Partial<OwnProfile>) => {
    setBusy(true);
    setErrors({});
    setMessage('');
    try {
      const res = await apiRequest<OwnProfile>('/me/profile', { method: 'PATCH', body });
      onSaved(res.data);
      toast.show(res.message);
      return res.data;
    } catch (e) {
      const { fields, message: m } = fromApi(e);
      setErrors(fields);
      setMessage(Object.keys(fields).length ? '' : m);
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, errors, message, save };
}

function DetailsPanel({ profile, onSaved }: { profile: OwnProfile; onSaved: (p: OwnProfile) => void }) {
  const t = useTranslations('profileSettings');
  const tc = useTranslations('common');
  const [form, setForm] = useState({
    displayName: profile.displayName,
    bio: profile.bio ?? '',
    education: profile.education ?? '',
    institution: profile.institution ?? '',
    location: profile.location ?? '',
    website: profile.website ?? '',
    birthYear: profile.birthYear ? String(profile.birthYear) : '',
  });
  const { busy, errors, message, save } = usePatch(onSaved);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    void save({ ...form, birthYear: form.birthYear ? Number(form.birthYear) : null });
  }

  return (
    <Panel title={t('details')} icon={<User className="h-5 w-5" />}>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {message ? <Alert tone="danger" className="sm:col-span-2">{message}</Alert> : null}
        <Field label={t('displayName')} error={errors.displayName} required className="sm:col-span-2">
          {(f) => <Input {...f} value={form.displayName} onChange={set('displayName')} autoComplete="name" />}
        </Field>
        <Field label={t('bio')} error={errors.bio} hint={t('bioHint')} className="sm:col-span-2">
          {(f) => <Textarea {...f} value={form.bio} onChange={set('bio')} maxLength={600} />}
        </Field>
        <Field label={t('education')} error={errors.education}>
          {(f) => <Input {...f} value={form.education} onChange={set('education')} />}
        </Field>
        <Field label={t('institution')} error={errors.institution}>
          {(f) => <Input {...f} value={form.institution} onChange={set('institution')} />}
        </Field>
        <Field label={t('location')} error={errors.location}>
          {(f) => <Input {...f} value={form.location} onChange={set('location')} autoComplete="address-level2" />}
        </Field>
        <Field label={t('birthYear')} error={errors.birthYear}>
          {(f) => <Input {...f} value={form.birthYear} onChange={set('birthYear')} inputMode="numeric" maxLength={4} />}
        </Field>
        <Field label={t('website')} error={errors.website} className="sm:col-span-2">
          {(f) => <Input {...f} value={form.website} onChange={set('website')} type="url" inputMode="url" placeholder="https://" />}
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={busy}>
            {tc('save')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function PrivacyPanel({ profile, onSaved }: { profile: OwnProfile; onSaved: (p: OwnProfile) => void }) {
  const t = useTranslations('profileSettings');
  const { busy, save } = usePatch(onSaved);
  const keys = ['profileVisibility', 'readingStatsVisibility', 'libraryVisibility', 'activityVisibility'] as const;
  return (
    <Panel title={t('privacy')} description={t('privacyText')} icon={<Eye className="h-5 w-5" />}>
      <div className="grid gap-4 sm:grid-cols-2">
        {keys.map((key) => (
          <Field key={key} label={t(key)}>
            {(f) => (
              <Select {...f} value={profile[key]} disabled={busy} onChange={(e) => void save({ [key]: e.target.value as Visibility })}>
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {t(`visibility_${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ))}
      </div>
    </Panel>
  );
}

function PreferencesPanel({ profile, onSaved }: { profile: OwnProfile; onSaved: (p: OwnProfile) => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { busy, save } = usePatch(onSaved);
  const clearSearches = async () => {
    try {
      const res = await apiRequest('/me/search-history', { method: 'DELETE' });
      toast.show(res.message, 'success');
    } catch {
      toast.show(t('errors.generic'), 'danger');
    }
  };
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  return (
    <Panel title={t('profileSettings.preferences')} icon={<Settings2 className="h-5 w-5" />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('profileSettings.language')}>
          {(f) => (
            <Select
              {...f}
              value={profile.locale}
              disabled={busy}
              onChange={async (e) => {
                const next = e.target.value as 'bn' | 'en';
                if (await save({ locale: next })) if (next !== locale) router.replace(pathname, { locale: next });
              }}
            >
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </Select>
          )}
        </Field>
        <Field label={t('profileSettings.theme')}>
          {(f) => (
            <Select
              {...f}
              value={profile.theme}
              disabled={busy}
              onChange={async (e) => {
                const theme = e.target.value as OwnProfile['theme'];
                applyTheme(theme);
                await save({ theme });
              }}
            >
              <option value="system">{t('common.themeSystem')}</option>
              <option value="light">{t('common.themeLight')}</option>
              <option value="dark">{t('common.themeDark')}</option>
            </Select>
          )}
        </Field>
      </div>
      <div id="personalization" className="mt-4 scroll-mt-24 space-y-3">
        <Checkbox
          label={
            <span>
              <span className="font-semibold">{t('profileSettings.personalization')}</span>
              <span className="block text-fg-muted">{t('profileSettings.personalizationText')}</span>
            </span>
          }
          checked={profile.personalizationEnabled}
          disabled={busy}
          onChange={(e) => void save({ personalizationEnabled: e.target.checked })}
        />
        <div className="rounded-lg bg-subtle p-3.5 text-sm text-fg-muted">
          <p>{t('recommendations.signals')}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={clearSearches}>
            {t('recommendations.clearSearches')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function DataPanel() {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  return (
    <Panel title={t('profileSettings.data')} description={t('profileSettings.exportText')} icon={<Download className="h-5 w-5" />}>
      <Button
        variant="outline"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { blob, filename } = await apiDownload('/me/export');
            const url = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement('a'), { href: url, download: filename });
            a.click();
            URL.revokeObjectURL(url);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('profileSettings.export')}
      </Button>
    </Panel>
  );
}

function DeletePanel() {
  const t = useTranslations();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage('');
    try {
      await api('/me/delete', { method: 'POST', body: { password: user?.hasPassword ? password : undefined, confirm } });
      toast.show(t('profileSettings.deleted'));
      await signOut();
      router.replace('/');
    } catch (err) {
      const { fields, message: m } = fromApi(err);
      setErrors(fields);
      setMessage(Object.keys(fields).length ? '' : m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={t('profileSettings.deleteTitle')} description={t('profileSettings.deleteText')} icon={<Trash2 className="h-5 w-5" />}>
      {open ? (
        <form onSubmit={submit} noValidate className="space-y-4">
          {message ? <Alert tone="danger">{message}</Alert> : null}
          {user?.hasPassword ? (
            <Field label={t('auth.password')} error={errors.password} required>
              {(f) => <PasswordInput {...f} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
            </Field>
          ) : null}
          <Field label={t('profileSettings.deleteConfirm')} error={errors.confirm} required>
            {(f) => <Input {...f} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" />}
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={busy} disabled={confirm !== 'DELETE'}>
              {t('profileSettings.deleteButton')}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          {t('profileSettings.deleteButton')}
        </Button>
      )}
    </Panel>
  );
}
