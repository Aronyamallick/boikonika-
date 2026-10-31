'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { ApiError } from '@/lib/api/client';

export type FieldErrors = Record<string, string>;

/**
 * Client checks use the shared field rules (which return i18n keys); API errors arrive already
 * translated. Both end up as per-field messages plus an optional form-level message.
 */
export function useFormErrors() {
  const t = useTranslations();

  /** { field: "validation.key" | null } → translated messages for the fields that failed. */
  const fromChecks = useCallback(
    (checks: Record<string, string | null | undefined | false>): FieldErrors =>
      Object.fromEntries(Object.entries(checks).filter((e): e is [string, string] => !!e[1]).map(([field, key]) => [field, t(key)])),
    [t],
  );

  const fromApi = useCallback(
    (error: unknown): { fields: FieldErrors; message: string } => {
      if (error instanceof ApiError) {
        if (error.code === 'NETWORK') return { fields: {}, message: t('errors.network') };
        return { fields: error.fieldErrors, message: error.message || t('errors.generic') };
      }
      return { fields: {}, message: t('errors.generic') };
    },
    [t],
  );

  return { fromChecks, fromApi };
}
