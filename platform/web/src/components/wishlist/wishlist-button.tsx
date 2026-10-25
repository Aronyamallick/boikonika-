'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button, buttonClasses } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname } from '@/i18n/navigation';
import { api, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/forms/errors';

/** Heart toggle that saves a book (any edition, any seller) or a product to my wishlist. */
export function WishlistButton({ kind, id, title, className }: { kind: 'books' | 'products'; id: string; title: string; className?: string }) {
  const t = useTranslations('wishlist');
  const { status } = useAuth();
  const pathname = usePathname();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    api<{ books: string[]; products: string[] }>('/me/wishlist/contains', { query: { [kind]: id } }).then((r) => setSaved(r[kind].includes(id)), () => setSaved(false));
  }, [status, kind, id]);

  if (status === 'anonymous') {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses({ variant: 'outline', className })}>
        <Heart className="h-4 w-4" aria-hidden="true" />
        {t('save')}
      </Link>
    );
  }

  const toggle = async () => {
    const next = !saved;
    setBusy(true);
    setSaved(next);
    try {
      const res = await apiRequest(`/me/wishlist/${kind}/${id}`, { method: next ? 'PUT' : 'DELETE' });
      toast.show(res.message, 'success');
    } catch (err) {
      setSaved(!next);
      toast.show(fromApi(err).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" className={className} aria-pressed={saved === true} aria-label={saved ? t('savedTitle', { title }) : t('saveTitle', { title })} disabled={saved === null || busy} onClick={toggle}>
      <Heart className={cn('h-4 w-4', saved && 'fill-danger text-danger')} aria-hidden="true" />
      {saved ? t('saved') : t('save')}
    </Button>
  );
}
