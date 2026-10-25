import { bookListQuerySchema, productListQuerySchema } from '@boikonika/shared';
import type { z } from 'zod';

/**
 * Keeps only the query params the API accepts and drops invalid ones (a hand-edited or stale URL
 * shows the unfiltered list instead of an error page).
 */
function sanitize(schema: z.ZodObject, params: Record<string, string>): Record<string, string> {
  const known = Object.fromEntries(Object.entries(params).filter(([k]) => k in schema.shape));
  const result = schema.safeParse(known);
  if (result.success) return known;
  const bad = new Set(result.error.issues.map((i) => String(i.path[0])));
  return Object.fromEntries(Object.entries(known).filter(([k]) => !bad.has(k)));
}

export const sanitizeBookParams = (params: Record<string, string>) => sanitize(bookListQuerySchema, params);
export const sanitizeProductParams = (params: Record<string, string>) => sanitize(productListQuerySchema, params);
