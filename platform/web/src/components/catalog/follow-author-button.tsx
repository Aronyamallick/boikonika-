'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';

type FollowState = { following: boolean; followerCount: number };

/** Follow toggle for an author; the page is cached anonymously, so the viewer's state loads here. */
export function FollowAuthorButton({ slug, initialCount }: { slug: string; initialCount: number }) {
  const t = useTranslations();
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [state, setState] = useState<FollowState | null>(null);
  const [busy, setBusy] = useState(false);
  const path = `/authors/${encodeURIComponent(slug)}/follow`;

  useEffect(() => {
    if (status !== 'authenticated') return setState(null);
    api<FollowState>(path).then(setState, () => undefined);
  }, [status, path]);

  const count = state?.followerCount ?? initialCount;
  const label = <span className="text-sm text-fg-muted">{t('common.followers', { count })}</span>;

  if (status !== 'authenticated') {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={() => router.push(`/login?next=${encodeURIComponent(pathname)}`)}>{t('common.follow')}</Button>
        {label}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Button
        variant={state?.following ? 'outline' : 'primary'}
        loading={busy || !state}
        aria-pressed={state?.following ?? false}
        onClick={async () => {
          if (!state) return;
          setBusy(true);
          try {
            setState(await api<FollowState>(path, { method: state.following ? 'DELETE' : 'POST' }));
          } catch {
            toast.show(t('catalog.followFailed'), 'danger');
          } finally {
            setBusy(false);
          }
        }}
      >
        {state?.following ? t('common.following') : t('common.follow')}
      </Button>
      {label}
    </div>
  );
}
