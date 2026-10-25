'use client';

import { localizeDigits } from '@boikonika/shared';
import { BadgeCheck, ExternalLink, Eye, Megaphone, PenLine, Search, ShoppingBag, Star, UserRound, Users } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CreatorBooksTable, ImageUploader, ViewsSalesCharts, type CreatorBook, type DailyPoint } from '@/components/dashboard/creator-parts';
import { StatTile } from '@/components/dashboard/stat-tile';
import { FormSection } from '@/components/seller/form-parts';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Rating } from '@/components/ui/rating';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest, ApiError } from '@/lib/api/client';
import { useFormErrors, type FieldErrors } from '@/lib/forms/errors';

interface AuthorDashboardData {
  profile: { id: string; slug: string; name: string; nameAlt: string | null; bio: string | null; website: string | null; birthYear: number | null; photoUrl: string | null; verified: boolean };
  stats: { books: number; followers: number; sales: number; views: number; rating: number; ratingCount: number };
  series: DailyPoint[];
  books: CreatorBook[];
  reviews: Array<{ id: string; rating: number; title: string | null; body: string | null; book: { title: string; slug: string }; user: string; createdAt: string }>;
  claims: Array<{ id: string; status: 'pending' | 'approved' | 'rejected'; authorName: string; createdAt: string; reason: string | null }>;
}

const CLAIM_TONE = { pending: 'warning', approved: 'success', rejected: 'danger' } as const;

export function AuthorDashboard() {
  const t = useTranslations();
  const [data, setData] = useState<AuthorDashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not_author' | 'failed'>('loading');

  const load = useCallback(() => {
    api<AuthorDashboardData>('/author/dashboard').then(
      (d) => (setData(d), setState('ready')),
      (e) => setState(e instanceof ApiError && e.status === 403 ? 'not_author' : 'failed'),
    );
  }, []);
  useEffect(load, [load]);

  if (state === 'not_author') {
    return (
      <EmptyState
        icon={<PenLine className="h-6 w-6" />}
        title={t('authorDashboard.notAuthorTitle')}
        text={t('authorDashboard.notAuthorText')}
        action={
          <Link href="/account/verification?purpose=author" className={buttonClasses()}>
            {t('authorDashboard.apply')}
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

  return (
    <div className="space-y-6">
      <ProfileHeader profile={data.profile} />
      <Tabs
        tabs={[
          { label: t('creatorDashboard.overview'), content: <Overview data={data} /> },
          { label: t('creatorDashboard.profile'), content: <ProfileForm profile={data.profile} onSaved={load} /> },
          { label: t('authorDashboard.updates'), content: <AnnouncementForm books={data.books} followers={data.stats.followers} /> },
          { label: t('authorDashboard.claims'), content: <Claims claims={data.claims} onClaimed={load} /> },
        ]}
      />
    </div>
  );
}

function ProfileHeader({ profile }: { profile: AuthorDashboardData['profile'] }) {
  const t = useTranslations();
  return (
    <header className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-fg-subtle">
        {/* eslint-disable-next-line @next/next/no-img-element -- author photo */}
        {profile.photoUrl ? <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg-muted">{t('authorDashboard.title')}</p>
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
      <Link href={`/authors/${profile.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        {t('creatorDashboard.viewPage')}
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </Link>
    </header>
  );
}

function Overview({ data }: { data: AuthorDashboardData }) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t('creatorDashboard.statBooks')} value={format.number(data.stats.books)} icon={<PenLine className="h-4 w-4" />} />
        <StatTile label={t('creatorDashboard.statFollowers')} value={format.number(data.stats.followers)} icon={<Users className="h-4 w-4" />} />
        <StatTile label={t('creatorDashboard.statSales')} value={format.number(data.stats.sales)} icon={<ShoppingBag className="h-4 w-4" />} hint={t('creatorDashboard.allTime')} />
        <StatTile
          label={t('creatorDashboard.statRating')}
          value={data.stats.ratingCount ? localizeDigits(data.stats.rating.toFixed(1), locale) : '—'}
          icon={<Star className="h-4 w-4" />}
          hint={t('book.ratingsCount', { count: data.stats.ratingCount })}
        />
      </div>
      <ViewsSalesCharts series={data.series} />
      <section aria-labelledby="author-books" className="space-y-3">
        <h2 id="author-books" className="text-lg font-bold text-fg">
          {t('creatorDashboard.books')}
        </h2>
        <CreatorBooksTable books={data.books} empty={t('authorDashboard.noBooks')} />
      </section>
      <section aria-labelledby="author-reviews" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="author-reviews" className="mb-3 font-bold text-fg">
          {t('creatorDashboard.recentReviews')}
        </h2>
        {data.reviews.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('creatorDashboard.noReviews')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.reviews.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Rating value={r.rating} label={t('book.rating', { rating: localizeDigits(r.rating, locale) })} />
                  <span className="font-semibold text-fg">{r.user}</span>
                  <span className="text-fg-subtle">{format.dateTime(new Date(r.createdAt), { dateStyle: 'medium' })}</span>
                </div>
                <Link href={`/books/${r.book.slug}#ratings`} className="mt-1 block text-xs font-semibold text-primary hover:underline">
                  {r.book.title}
                </Link>
                {r.title ? <p className="mt-1 font-semibold text-fg">{r.title}</p> : null}
                {r.body ? <p className="mt-0.5 line-clamp-4 whitespace-pre-line text-sm text-fg">{r.body}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        {t('creatorDashboard.viewsNote', { count: data.stats.views })}
      </p>
    </div>
  );
}

function ProfileForm({ profile, onSaved }: { profile: AuthorDashboardData['profile']; onSaved: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [photo, setPhoto] = useState(profile.photoUrl);
  const [form, setForm] = useState({ nameAlt: profile.nameAlt ?? '', bio: profile.bio ?? '', website: profile.website ?? '', birthYear: profile.birthYear ? String(profile.birthYear) : '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await apiRequest('/author/profile', {
        method: 'PATCH',
        body: { nameAlt: form.nameAlt.trim() || null, bio: form.bio.trim() || null, website: form.website.trim(), birthYear: form.birthYear.trim() ? form.birthYear.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))) : null },
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
      <FormSection title={t('creatorDashboard.photo')}>
        <ImageUploader src={photo} endpoint="/author/photo" label={t('creatorDashboard.changePhoto')} fallback={<UserRound className="h-10 w-10" aria-hidden="true" />} onUploaded={setPhoto} />
      </FormSection>
      <FormSection title={t('creatorDashboard.about')}>
        <Field label={t('creatorDashboard.name')} hint={t('authorDashboard.nameHint')}>
          {(p) => <Input {...p} value={profile.name} readOnly disabled />}
        </Field>
        <Field label={t('creatorDashboard.nameAlt')} hint={t('creatorDashboard.nameAltHint')} error={errors.nameAlt}>
          {(p) => <Input {...p} value={form.nameAlt} onChange={set('nameAlt')} maxLength={160} />}
        </Field>
        <Field label={t('authorDashboard.bio')} error={errors.bio}>
          {(p) => <Textarea {...p} value={form.bio} onChange={set('bio')} rows={6} maxLength={5000} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('creatorDashboard.website')} error={errors.website}>
            {(p) => <Input {...p} value={form.website} onChange={set('website')} type="url" inputMode="url" placeholder="https://" maxLength={300} />}
          </Field>
          <Field label={t('authorDashboard.birthYear')} error={errors.birthYear}>
            {(p) => <Input {...p} value={form.birthYear} onChange={set('birthYear')} inputMode="numeric" maxLength={4} />}
          </Field>
        </div>
      </FormSection>
      <Button type="submit" loading={busy}>
        {t('common.save')}
      </Button>
    </form>
  );
}

function AnnouncementForm({ books, followers }: { books: CreatorBook[]; followers: number }) {
  const t = useTranslations();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [form, setForm] = useState({ title: '', body: '', bookId: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: FieldErrors = {};
    if (form.title.trim().length < 3) found.title = t('validation.required');
    if (form.body.trim().length < 10) found.body = t('validation.tooShort');
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const res = await apiRequest('/author/announcements', { method: 'POST', body: { title: form.title, body: form.body, bookId: form.bookId || undefined } });
      toast.show(res.message, 'success');
      setForm({ title: '', body: '', bookId: '' });
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl">
      <FormSection title={t('authorDashboard.newUpdate')}>
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('authorDashboard.updateText', { count: followers })}
        </p>
        <Field label={t('authorDashboard.updateTitle')} required error={errors.title}>
          {(p) => <Input {...p} value={form.title} onChange={set('title')} maxLength={120} />}
        </Field>
        <Field label={t('authorDashboard.updateBody')} required error={errors.body} hint={t('authorDashboard.updateBodyHint')}>
          {(p) => <Textarea {...p} value={form.body} onChange={set('body')} rows={5} maxLength={1000} />}
        </Field>
        {books.length ? (
          <Field label={t('authorDashboard.updateBook')} error={errors.bookId}>
            {(p) => (
              <Select {...p} value={form.bookId} onChange={set('bookId')}>
                <option value="">{t('authorDashboard.noBook')}</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <div>
          <Button type="submit" loading={busy}>
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            {t('authorDashboard.postUpdate')}
          </Button>
        </div>
      </FormSection>
    </form>
  );
}

interface Claimable {
  id: string;
  slug: string;
  name: string;
  nameAlt: string | null;
  bookCount: number;
}

function Claims({ claims, onClaimed }: { claims: AuthorDashboardData['claims']; onClaimed: () => void }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Claimable[] | null>(null);
  const [target, setTarget] = useState<Claimable | null>(null);
  const [form, setForm] = useState({ message: '', evidenceUrl: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api<Claimable[]>('/author/claimable', { query: { q: term } }).then(setResults, () => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    const found: FieldErrors = {};
    if (form.message.trim().length < 20) found.message = t('validation.tooShort');
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const res = await apiRequest('/author/claims', { method: 'POST', body: { authorId: target.id, message: form.message, evidenceUrl: form.evidenceUrl } });
      toast.show(res.message, 'success');
      setTarget(null);
      setForm({ message: '', evidenceUrl: '' });
      setQ('');
      onClaimed();
    } catch (err) {
      const { fields, message } = fromApi(err);
      setErrors(fields);
      if (!Object.keys(fields).length) toast.show(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <FormSection title={t('authorDashboard.claimTitle')}>
        <p className="text-sm text-fg-muted">{t('authorDashboard.claimText')}</p>
        <Field label={t('authorDashboard.claimSearch')}>
          {(p) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <Input {...p} value={q} onChange={(e) => setQ(e.target.value)} type="search" className="pl-9" maxLength={120} autoComplete="off" />
            </div>
          )}
        </Field>
        {results === null ? null : results.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('authorDashboard.claimNone')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line" aria-live="polite">
            {results.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <Link href={`/authors/${a.slug}`} className="font-semibold text-fg hover:text-primary" target="_blank">
                    {a.name}
                  </Link>
                  <span className="block text-xs text-fg-muted">
                    {[a.nameAlt, t('catalog.bookCount', { count: a.bookCount })].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => (setTarget(a), setErrors({}))}>
                  {t('authorDashboard.claim')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <section aria-labelledby="my-claims" className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 id="my-claims" className="mb-3 font-bold text-fg">
          {t('authorDashboard.myClaims')}
        </h2>
        {claims.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('authorDashboard.noClaims')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-semibold text-fg">{c.authorName}</span>
                  <span className="block text-xs text-fg-subtle">{format.dateTime(new Date(c.createdAt), { dateStyle: 'medium' })}</span>
                  {c.reason ? <span className="mt-1 block text-xs text-fg-muted">{c.reason}</span> : null}
                </span>
                <Badge tone={CLAIM_TONE[c.status]}>{t(`authorDashboard.claimStatus.${c.status}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={!!target}
        onClose={() => setTarget(null)}
        title={target ? t('authorDashboard.claimDialog', { name: target.name }) : ''}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="claim-form" loading={busy}>
              {t('authorDashboard.sendClaim')}
            </Button>
          </>
        }
      >
        <form id="claim-form" onSubmit={submit} noValidate className="space-y-4">
          <Field label={t('authorDashboard.claimMessage')} required hint={t('authorDashboard.claimMessageHint')} error={errors.message}>
            {(p) => <Textarea {...p} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={5} maxLength={2000} />}
          </Field>
          <Field label={t('authorDashboard.claimEvidence')} hint={t('authorDashboard.claimEvidenceHint')} error={errors.evidenceUrl}>
            {(p) => <Input {...p} value={form.evidenceUrl} onChange={(e) => setForm((f) => ({ ...f, evidenceUrl: e.target.value }))} type="url" inputMode="url" placeholder="https://" maxLength={500} />}
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
