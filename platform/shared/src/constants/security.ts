/**
 * Argon2id parameters (OWASP Password Storage Cheat Sheet: m=19 MiB, t=2, p=1). Shared so the API
 * and the seed script produce identical hashes; raising them later is safe because the parameters
 * are stored inside each hash and old hashes are re-hashed on the next successful login.
 */
export const ARGON2_OPTIONS = { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export const PASSWORD_POLICY = { minLength: 8, maxLength: 128 } as const;

/** Letters (any script) and digits (ASCII or Bangla) are both required. */
export function passwordProblems(password: string): Array<'too_short' | 'too_long' | 'needs_letter' | 'needs_number'> {
  const problems: Array<'too_short' | 'too_long' | 'needs_letter' | 'needs_number'> = [];
  const length = [...password].length;
  if (length < PASSWORD_POLICY.minLength) problems.push('too_short');
  if (length > PASSWORD_POLICY.maxLength) problems.push('too_long');
  if (!/\p{L}/u.test(password)) problems.push('needs_letter');
  if (!/[0-9০-৯]/.test(password)) problems.push('needs_number');
  return problems;
}
