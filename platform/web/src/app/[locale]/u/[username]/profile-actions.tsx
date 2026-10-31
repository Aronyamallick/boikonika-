'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button, buttonClasses } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/forms/errors';
import type { PublicProfile } from '@/lib/types';

/** Follow / unfollow / block for the signed-in viewer (the page itself is rendered anonymously for caching and SEO). */
export function ProfileActions({ username }: { username: string }) {
  const t = useTranslations();
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [viewer, setViewer] = useState<PublicProfile['viewer'] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return setViewer(null);
    api<PublicProfile>(`/users/${encodeURIComponent(username)}`).then((p) => setViewer(p.viewer), () => undefined);
  }, [status, username]);

  const act = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      toast.show(fromApi(e).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (status !== 'authenticated') {
    return (
      <Button onClick={() => router.push(`/login?next=${encodeURIComponent(pathname)}`)}>
        {t('common.follow')}
      </Button>
    );
  }
  if (!viewer) return <span className="inline-block h-11 w-28 animate-pulse rounded-lg bg-skeleton" aria-hidden="true" />;
  if (viewer.self) {
    return (
      <Link href="/account/profile" className={buttonClasses({ variant: 'outline' })}>
        {t('profile.editProfile')}
      </Link>
    );
  }
  if (viewer.blocked) {
    return (
      <Button
        variant="outline"
        loading={busy}
        onClick={() =>
          act(async () => {
            const res = await api<{ blocked: boolean }>(`/users/${username}/block`, { method: 'DELETE' });
            setViewer({ ...viewer, blocked: res.blocked });
          })
        }
      >
        {t('profile.unblock')}
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Button
        variant={viewer.following ? 'outline' : 'primary'}
        loading={busy}
        aria-pressed={viewer.following}
        onClick={() =>
          act(async () => {
            const res = await api<{ following: boolean; followerCount: number }>(`/users/${username}/follow`, { method: viewer.following ? 'DELETE' : 'POST' });
            setViewer({ ...viewer, following: res.following });
          })
        }
      >
        {viewer.following ? t('common.following') : t('common.follow')}
      </Button>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() =>
          act(async () => {
            await api(`/users/${username}/block`, { method: 'POST' });
            setViewer({ ...viewer, blocked: true, following: false });
          })
        }
      >
        {t('profile.block')}
      </Button>
    </div>
  );
}
