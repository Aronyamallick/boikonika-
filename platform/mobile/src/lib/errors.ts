import { ApiError } from './api';

type T = (key: string) => string;

/** The message to show for a failed request: the API's own (already in the reader's language), or a fallback. */
export function errorMessage(error: unknown, t: T): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK') return t('errors.network');
    if (error.message) return error.message;
  }
  return t('errors.generic');
}

/** Field errors from a 422 response, keyed by field name. */
export const fieldErrors = (error: unknown): Record<string, string> => (error instanceof ApiError ? error.fieldErrors : {});
