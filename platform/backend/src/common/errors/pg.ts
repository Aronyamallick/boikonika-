export interface PgError {
  code: string;
  constraint?: string;
  detail?: string;
  column?: string;
  table?: string;
}

/**
 * Finds the PostgreSQL error inside whatever was thrown. Drizzle wraps driver errors in
 * DrizzleQueryError (original in `cause`), so the chain is walked a few levels deep.
 */
export function pgErrorOf(error: unknown): PgError | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    const candidate = current as Partial<PgError> & { cause?: unknown };
    if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) return candidate as PgError;
    current = candidate.cause;
  }
  return null;
}

export const isUniqueViolation = (error: unknown, constraint?: string): boolean => {
  const pg = pgErrorOf(error);
  return pg?.code === '23505' && (!constraint || pg.constraint === constraint);
};
