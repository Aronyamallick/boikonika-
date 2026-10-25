'use client';

import { ArrowDown, ArrowUp, Eye, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Markdown } from '@/components/content/markdown';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import type { FieldErrors } from '@/lib/forms/errors';

export type Bilingual = { bn: string; en: string };
export const emptyBilingual = (): Bilingual => ({ bn: '', en: '' });
export const toBilingual = (v: { bn?: string; en?: string } | null | undefined): Bilingual => ({ bn: v?.bn ?? '', en: v?.en ?? '' });

/**
 * One piece of text in both languages, side by side on wide screens. Errors arrive as
 * `${name}.bn` / `${name}.en`. `markdown` gives each language a Markdown editor with preview.
 */
export function BilingualField({
  name,
  label,
  hint,
  value,
  onChange,
  errors,
  required,
  multiline,
  markdown,
  rows = 4,
  maxLength,
}: {
  name: string;
  label: string;
  hint?: string;
  value: Bilingual;
  onChange: (v: Bilingual) => void;
  errors: FieldErrors;
  required?: boolean;
  multiline?: boolean;
  markdown?: boolean;
  rows?: number;
  maxLength?: number;
}) {
  const t = useTranslations('adminContent');
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold text-fg">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </legend>
      {hint ? <p className="text-sm text-fg-subtle">{hint}</p> : null}
      <div className={cn('grid gap-3', !markdown && 'md:grid-cols-2')}>
        {(['bn', 'en'] as const).map((lang) => (
          <Field key={lang} label={<span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t(`lang.${lang}`)}</span>} error={errors[`${name}.${lang}`] ?? (lang === 'bn' ? errors[name] : undefined)} required={required}>
            {(p) =>
              markdown ? (
                <MarkdownEditor {...p} lang={lang} value={value[lang]} onChange={(v) => onChange({ ...value, [lang]: v })} rows={rows} maxLength={maxLength} />
              ) : multiline ? (
                <Textarea {...p} lang={lang} value={value[lang]} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} rows={rows} maxLength={maxLength} />
              ) : (
                <Input {...p} lang={lang} value={value[lang]} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} maxLength={maxLength} />
              )
            }
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

/** A Markdown textarea with a Write/Preview switch and a one-line syntax reminder. */
export function MarkdownEditor({
  value,
  onChange,
  rows = 12,
  maxLength,
  lang,
  ...aria
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
  lang?: string;
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  required?: boolean;
}) {
  const t = useTranslations('adminContent');
  const [preview, setPreview] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-line-input">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-subtle px-2 py-1.5">
        <p className="truncate text-xs text-fg-subtle">{t('markdownHelp')}</p>
        <Button type="button" size="sm" variant="ghost" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
          {preview ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {preview ? t('write') : t('preview')}
        </Button>
      </div>
      {preview ? (
        <div className="max-h-[32rem] min-h-40 overflow-auto bg-surface p-4" lang={lang}>
          {value.trim() ? <Markdown source={value} /> : <p className="text-sm text-fg-subtle">{t('nothingToPreview')}</p>}
        </div>
      ) : (
        <Textarea {...aria} lang={lang} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength} className="rounded-none border-0 font-mono text-sm leading-relaxed focus:ring-0" />
      )}
    </div>
  );
}

/** Move an item up or down a list (the keyboard-friendly alternative to dragging). */
export function MoveButtons({ index, count, onMove, label }: { index: number; count: number; onMove: (from: number, to: number) => void; label: string }) {
  const t = useTranslations('adminContent');
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} className="rounded p-1 text-fg-muted hover:bg-subtle hover:text-fg disabled:opacity-30" aria-label={t('moveUp', { name: label })}>
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} className="rounded p-1 text-fg-muted hover:bg-subtle hover:text-fg disabled:opacity-30" aria-label={t('moveDown', { name: label })}>
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  );
}

/** Returns a copy of `list` with one item moved. */
export function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
