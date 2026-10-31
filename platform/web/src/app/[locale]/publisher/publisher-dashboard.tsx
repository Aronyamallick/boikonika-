'use client';

import { BadgeCheck, Building2, ExternalLink, PenLine, ShoppingBag, Tablet, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CreatorBooksTable, ImageUploader, ViewsSalesCharts, type CreatorBook, type DailyPoint } from '@/components/dashboard/creator-parts';
import { StatTile } from '@/components/dashboard/stat-tile';
import { FormSection } from '@/components/seller/form-parts';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest, ApiError } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface PublisherDashboardData {
  profile: { id: string; slug: string; name: string; nameAlt: string | null; description: string | null; website: string | null; foundedYear: number | null; logoUrl: string | null; verified: boolean };
  stats: { books: number; followers: number; sales: number; views: number; authors: number };
  series: DailyPoint[];
  books: CreatorBook[];
  authors: Array<{ id: string; slug: string; name: string; verified: boolean; books: number }>;
}

export function PublisherDashboard() {
  const t = useTranslations();
  const format = useFormatter();
  const [data, setData] = useState<PublisherDashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not_publisher' | 'failed'>('loading');

  const load = useCallback(() => {
    api<PublisherDashboardData>('/publisher/dashboard').then(
      (d) => (setData(d), setState('ready')),
      (e) => setState(e instanceof ApiError && e.status === 403 ? 'not_publisher' : 'failed'),
    );
  }, []);
  useEffect(load, [load]);

  if (state === 'not_publisher') {
    return (
      <EmptyState
        icon={<Building2 className="h-6 w-6" />}
        title={t('publisherDashboard.notPublisherTitle')}
        text={t('publisherDashboard.notPublisherText')}
        action={
          <Link href="/account/verification?purpose=publisher" className={buttonClasses()}>
            {t('publisherDashboard.apply')}
          </Link>
        }
      />
    );
  }
  if (state === 'failed') return <ErrorState title={t('common.errorTitle')} text={t('common.errorText')} retryLabel={t('common.retry')} onRetry={load} />;
  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const { profile, stats } = data;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-subtle text-fg-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element -- publisher logo */}
          {profile.logoUrl ? <img src={profile.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-8 w-8" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg-muted">{t('publisherDashboard.title')}</p>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-fg">
            {profile.name}
            {profile.verified ? (
              <Badge tone="primary">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t('common.verified')}
              </Badge>
            ) : null}
          </h1>
          {profile.nameAlt ? <p className="text-sm text-fg-muted">{profile.nameAlt}</p> : null}
        </div>
        <Link href="/studio/digital" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
          <Tablet className="h-4 w-4" aria-hidden="true" />
          {t('studio.title')}
        </Link>
        <Link href={`/publishers/${profile.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          {t('creatorDashboard.viewPage')}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      <Tabs
        tabs={[
          {
            label: t('creatorDashboard.overview'),
            content: (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatTile label={t('creatorDashboard.statBooks')} value={format.number(stats.books)} icon={<PenLine className="h-4 w-4" />} />
                  <StatTile label={t('publisherDashboard.statAuthors')} value={format.number(stats.authors)} icon={<Users className="h-4 w-4" />} />
                  <StatTile label={t('creatorDashboard.statFollowers')} value={format.number(stats.followers)} icon={<Users className="h-4 w-4" />} />
                  <StatTile label={t('creatorDashboard.statSales')} value={format.number(stats.sales)} icon={<ShoppingBag className="h-4 w-4" />} hint={t('creatorDashboard.allTime')} />
                </div>
                <ViewsSalesCharts series={data.series} />
                <section aria-labelledby="publisher-books" className="space-y-3">
                  <h2 id="publisher-books" className="text-lg font-bold text-fg">
                    {t('creatorDashboard.books')}
                  </h2>
                  <CreatorBooksTable books={data.books} empty={t('publisherDashboard.noBooks')} />
                </section>
                <section aria-labelledby="publisher-authors" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                  <h2 id="publisher-authors" className="mb-3 font-bold text-fg">
                    {t('publisherDashboard.authors')}
                  </h2>
                  {data.authors.length === 0 ? (
                    <p className="text-sm text-fg-muted">{t('publisherDashboard.noAuthors')}</p>
                  ) : (
                    <ul className="grid gap-x-6 sm:grid-cols-2">
                      {data.authors.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm">
                          <Link href={`/authors/${a.slug}`} className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-fg hover:text-primary">
                            <span className="truncate">{a.name}</span>
                            {a.verified ? <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label={t('common.verified')} /> : null}
                          </Link>
                          <span className="shrink-0 text-xs text-fg-muted">{t('catalog.bookCount', { count: a.books })}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ),
          },
          { label: t('creatorDashboard.profile'), content: <PublisherProfileForm profile={profile} onSaved={load} /> },
        ]}
      />
    </div>
  );
}

function PublisherProfileForm({ profile, onSaved }: { profile: PublisherDashboardData['profile']; onSaved: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [logo, setLogo] = useState(profile.logoUrl);
  const [form, setForm] = useState({ nameAlt: profile.nameAlt ?? '', description: profile.description ?? '', website: profile.website ?? '', foundedYear: profile.foundedYear ? String(profile.foundedYear) : '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await apiRequest('/publisher/profile', {
        method: 'PATCH',
        body: {
          nameAlt: form.nameAlt.trim() || null,
          description: form.description.trim() || null,
          website: form.website.trim(),
          foundedYear: form.foundedYear.trim() ? form.foundedYear.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))) : null,
        },
      });
      toast.show(res.message, 'success');
      onSaved();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate className="max-w-2xl space-y-6">
      <FormSection title={t('publisherDashboard.logo')}>
        <ImageUploader src={logo} endpoint="/publisher/logo" label={t('publisherDashboard.changeLogo')} fallback={<Building2 className="h-10 w-10" aria-hidden="true" />} onUploaded={setLogo} />
      </FormSection>
      <FormSection title={t('creatorDashboard.about')}>
        <Field label={t('creatorDashboard.name')} hint={t('publisherDashboard.nameHint')}>
          {(p) => <Input {...p} value={profile.name} readOnly disabled />}
        </Field>
        <Field label={t('creatorDashboard.nameAlt')} hint={t('creatorDashboard.nameAltHint')} error={errors.nameAlt}>
          {(p) => <Input {...p} value={form.nameAlt} onChange={set('nameAlt')} maxLength={200} />}
        </Field>
        <Field label={t('publisherDashboard.description')} error={errors.description}>
          {(p) => <Textarea {...p} value={form.description} onChange={set('description')} rows={6} maxLength={5000} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('creatorDashboard.website')} error={errors.website}>
            {(p) => <Input {...p} value={form.website} onChange={set('website')} type="url" inputMode="url" placeholder="https://" maxLength={300} />}
          </Field>
          <Field label={t('publisherDashboard.foundedYear')} error={errors.foundedYear}>
            {(p) => <Input {...p} value={form.foundedYear} onChange={set('foundedYear')} inputMode="numeric" maxLength={4} />}
          </Field>
        </div>
      </FormSection>
      <Button type="submit" loading={busy}>
        {t('common.save')}
      </Button>
    </form>
  );
}
