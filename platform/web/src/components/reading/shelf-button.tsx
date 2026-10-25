'use client';

import { LIBRARY_SHELVES, type LibraryShelf } from '@boikonika/shared';
import { BookmarkPlus, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { buttonClasses } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Link, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/forms/errors';

const CHOICES = LIBRARY_SHELVES.filter((s) => s !== 'purchased');

/** "Add to my library" on a book page: pick a shelf (Want to read, Reading, Finished, Owned). */
export function ShelfButton({ bookId, className }: { bookId: string; className?: string }) {
  const t = useTranslations('library');
  const { status } = useAuth();
  const pathname = usePathname();
  const toast = useToast();
  const { fromApi } = useFormErrors();
  const id = useId();
  const [shelf, setShelf] = useState<LibraryShelf | null | undefined>(undefined);

  useEffect(() => {
    if (status !== 'authenticated') return;
    api<{ shelf: LibraryShelf } | null>(`/me/library/${bookId}`).then((r) => setShelf(r?.shelf ?? null), () => setShelf(null));
  }, [status, bookId]);

  if (status === 'anonymous') {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClasses({ variant: 'outline', className })}>
        <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
        {t('addToLibrary')}
      </Link>
    );
  }
  if (shelf === undefined) return null;

  const choose = async (next: LibraryShelf) => {
    const before = shelf;
    setShelf(next);
    try {
      await api(`/me/library/${bookId}`, { method: 'PUT', body: { shelf: next } });
      toast.show(t('shelvedOn', { shelf: t(`shelves.${next}`) }), 'success');
    } catch (err) {
      setShelf(before);
      toast.show(fromApi(err).message, 'danger');
    }
  };

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {t('shelfFor')}
      </label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true">
        {shelf ? <Check className="h-4 w-4 text-success" /> : <BookmarkPlus className="h-4 w-4" />}
      </span>
      <select
        id={id}
        value={shelf ?? ''}
        onChange={(e) => e.target.value && choose(e.target.value as LibraryShelf)}
        className="h-11 w-full appearance-none rounded-lg border border-line-input bg-surface pl-9 pr-8 text-[15px] font-semibold text-fg hover:bg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
      >
        {shelf ? null : <option value="">{t('addToLibrary')}</option>}
        {shelf === 'purchased' ? <option value="purchased">{t('shelves.purchased')}</option> : null}
        {CHOICES.map((s) => (
          <option key={s} value={s}>
            {t(`shelves.${s}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
