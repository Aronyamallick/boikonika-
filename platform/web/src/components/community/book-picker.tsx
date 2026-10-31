'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { BookCover } from '@/components/ui/book-cover';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import type { BookTag } from '@/lib/community';

/** Combobox to tag a book (any published book, bought or not). */
export function BookPicker({ value, onChange, label, error, required }: { value: BookTag | null; onChange: (b: BookTag | null) => void; label: string; error?: string; required?: boolean }) {
  const t = useTranslations('community');
  const id = useId();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<BookTag[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const timer = setTimeout(() => {
      api<BookTag[]>('/community/books', { query: { q: term } }).then(
        (r) => (setItems(r), setActive(0), setOpen(true)),
        () => setItems([]),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const pick = (b: BookTag) => {
    onChange(b);
    setQ('');
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') setActive((a) => (a + 1) % items.length);
    else if (e.key === 'ArrowUp') setActive((a) => (a - 1 + items.length) % items.length);
    else if (e.key === 'Enter') pick(items[active]!);
    else if (e.key === 'Escape') setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <label htmlFor={`${id}-input`} className="mb-1.5 block text-sm font-semibold text-fg">
        {label} {required ? <span className="text-danger">*</span> : null}
      </label>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-line-input bg-surface p-2">
          <BookCover src={value.coverUrl} title={value.title} className="w-9 shrink-0 rounded p-0.5 text-[5px]" sizes="2.25rem" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="line-clamp-1 font-semibold text-fg">{value.title}</span>
            <span className="line-clamp-1 text-xs text-fg-muted">{value.authors.join(', ')}</span>
          </span>
          <button type="button" onClick={() => onChange(null)} className="rounded-md p-1.5 text-fg-muted hover:bg-subtle hover:text-fg" aria-label={t('removeBook')}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input
            id={`${id}-input`}
            role="combobox"
            aria-expanded={open && items.length > 0}
            aria-controls={`${id}-list`}
            aria-activedescendant={open && items[active] ? `${id}-opt-${active}` : undefined}
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => items.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={t('findBook')}
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-line-input bg-surface pl-9 pr-3 text-[15px] text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          {open && items.length ? (
            <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-surface-raised py-1 shadow-lg">
              {items.map((b, i) => (
                <li
                  key={b.id}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => (e.preventDefault(), pick(b))}
                  onMouseEnter={() => setActive(i)}
                  className={cn('flex cursor-pointer items-center gap-3 px-3 py-2 text-sm', i === active && 'bg-subtle')}
                >
                  <BookCover src={b.coverUrl} title={b.title} className="w-7 shrink-0 rounded p-0.5 text-[4px]" sizes="1.75rem" />
                  <span className="min-w-0">
                    <span className="line-clamp-1 font-semibold text-fg">{b.title}</span>
                    <span className="line-clamp-1 text-xs text-fg-muted">{b.authors.join(', ')}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
