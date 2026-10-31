import type { PageMeta } from '@boikonika/shared';

const ENVELOPE = Symbol('envelope');

export interface EnvelopeParts<T> {
  [ENVELOPE]: true;
  data: T;
  meta?: PageMeta;
  message?: string;
}

/** Return from a controller to attach pagination metadata to the standard envelope. */
export function paginated<T>(items: T[], meta: PageMeta, message?: string): EnvelopeParts<T[]> {
  return { [ENVELOPE]: true, data: items, meta, message };
}

/** Return from a controller to attach a user-facing success message. */
export function withMessage<T>(data: T, message: string): EnvelopeParts<T> {
  return { [ENVELOPE]: true, data, message };
}

export function isEnvelopeParts(value: unknown): value is EnvelopeParts<unknown> {
  return !!value && typeof value === 'object' && (value as Record<symbol, unknown>)[ENVELOPE] === true;
}
