'use client';

import type { KycStatus } from '@boikonika/shared';
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { use, useCallback, useEffect, useState } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Link } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { useFormErrors } from '@/lib/forms/errors';

interface Detail {
  id: string;
  purpose: string;
  requestedRole: string;
  status: KycStatus;
  legalName: string;
  businessName: string | null;
  institutionName: string | null;
  address: string | null;
  dateOfBirth: string | null;
  rejectionReason: string | null;
  reviewNote: string | null;
  submittedAt: string;
  documents: Array<{ id: string; type: string; side: string; numberLast4: string | null; mimeType: string; sizeBytes: number; purged: boolean }>;
  events: Array<{ event: string; fromStatus: string | null; toStatus: string | null; actorId: string | null; note: string | null; at: string }>;
  history: Array<{ id: string; status: KycStatus; submittedAt: string; rejectionReason: string | null }>;
  user: { id: string; username: string; displayName: string; email: string | null; phone: string | null; createdAt: string } | null;
}

export default function KycDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const { can, user: me } = useAuth();
  const { fromApi } = useFormErrors();
  const [item, setItem] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<Record<string, { number: string | null; url: string }>>({});

  const load = useCallback(() => {
    api<Detail>(`/admin/kyc/${id}`).then(setItem, (e) => setError(fromApi(e).message));
  }, [id, fromApi]);
  useEffect(load, [load]);

  async function act(path: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest<Detail>(`/admin/kyc/${id}/${path}`, { method: 'POST', body });
      setItem(res.data);
      setText('');
      toast.show(res.message);
    } catch (e) {
      setError(fromApi(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(documentId: string) {
    // Open the tab synchronously (popup blockers), then point it at the short-lived link. "noopener"
    // would make window.open return null, so the opener reference is cut manually instead.
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    try {
      const res = await api<{ url: string; number: string | null }>(`/admin/kyc/${id}/documents/${documentId}`);
      setOpened((o) => ({ ...o, [documentId]: { number: res.number, url: res.url } }));
      if (win) win.location.href = res.url;
    } catch (e) {
      win?.close();
      setError(fromApi(e).message);
    }
  }

  if (error && !item) return <Alert tone="danger">{error}</Alert>;
  if (!item) return <Skeleton className="h-96 w-full" />;
  const decidable = item.status === 'pending' || item.status === 'under_review';
  const own = item.user?.id === me?.id;

  return (
    <RequirePermission permission="kyc.view">
      <Link href="/admin/kyc" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('adminKyc.back')}
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{item.legalName}</h1>
        <Badge tone={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}>{t(`status.kyc.${item.status}`)}</Badge>
      </div>
      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-3 font-bold">{t('adminKyc.details')}</h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                [t('verification.purpose'), `${t(`verification.purpose_${item.purpose}`)} · ${t(`roles.${item.requestedRole}`)}`],
                [t('adminKyc.applicant'), item.user ? `${item.user.displayName} (@${item.user.username})` : '—'],
                [t('auth.phone'), item.user?.phone ?? '—'],
                [t('auth.email'), item.user?.email ?? '—'],
                [t('verification.businessName'), item.businessName ?? item.institutionName ?? '—'],
                [t('verification.dateOfBirth'), item.dateOfBirth ?? '—'],
                [t('verification.address'), item.address ?? '—'],
                [t('adminKyc.submittedAt'), format.dateTime(new Date(item.submittedAt), { dateStyle: 'medium', timeStyle: 'short' })],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-fg-subtle">{k}</dt>
                  <dd className="font-medium text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-bold">{t('adminKyc.documents')}</h2>
            <p className="mb-3 text-xs text-fg-subtle">{t('adminKyc.viewLogged')}</p>
            <ul className="divide-y divide-line">
              {item.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                  <FileText className="h-5 w-5 text-fg-subtle" aria-hidden="true" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">{t(`verification.doc_${d.type}`)} · {t(`verification.side_${d.side}`)}</p>
                    <p className="text-fg-muted">
                      {[opened[d.id]?.number ? `${t('adminKyc.documentNumber')}: ${opened[d.id]!.number}` : d.numberLast4 ? `••${d.numberLast4}` : null, `${Math.max(1, Math.round(d.sizeBytes / 1024))} KB`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {can('kyc.documents.view') && !d.purged && !own ? (
                    <Button variant="outline" size="sm" onClick={() => openDocument(d.id)}>
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {t('adminKyc.viewDocument')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-3 font-bold">{t('adminKyc.events')}</h2>
            <ol className="space-y-1.5 border-l-2 border-line pl-4 text-sm">
              {item.events.map((e, i) => (
                <li key={i}>
                  <span className="font-semibold">{t.has(`verification.event_${e.event}`) ? t(`verification.event_${e.event}`) : e.event}</span>
                  <span className="text-fg-muted"> · {format.dateTime(new Date(e.at), { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {e.note ? <p className="text-fg-muted">{e.note}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          {decidable && !own ? (
            <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
              {item.status === 'pending' ? (
                <Button variant="outline" className="w-full" loading={busy} onClick={() => act('review')}>
                  {t('adminKyc.startReview')}
                </Button>
              ) : null}
              <Field label={t('adminKyc.reasonLabel')} hint={t('adminKyc.note')}>
                {(f) => <Textarea {...f} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />}
              </Field>
              {can('kyc.approve') ? (
                <Button className="w-full" variant="secondary" loading={busy} onClick={() => act('approve', { note: text || undefined })}>
                  {t('adminKyc.approve')}
                </Button>
              ) : null}
              {can('kyc.reject') ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={busy || text.trim().length < 5} onClick={() => act('request-resubmission', { reason: text })}>
                    {t('adminKyc.requestResubmission')}
                  </Button>
                  <Button variant="danger" disabled={busy || text.trim().length < 5} onClick={() => act('reject', { reason: text })}>
                    {t('adminKyc.reject')}
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}
          {item.rejectionReason || item.reviewNote ? (
            <Alert tone="info" title={t('verification.reason')}>
              {item.rejectionReason ?? item.reviewNote}
            </Alert>
          ) : null}
          {item.history.length > 1 ? (
            <section className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="mb-2 font-bold">{t('adminKyc.history')}</h2>
              <ul className="space-y-2 text-sm">
                {item.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/kyc/${h.id}`} className={h.id === item.id ? 'font-semibold' : 'text-primary hover:underline'}>
                      {format.dateTime(new Date(h.submittedAt), { dateStyle: 'medium' })}
                    </Link>
                    <Badge>{t(`status.kyc.${h.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </RequirePermission>
  );
}
