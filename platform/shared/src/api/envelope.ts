/**
 * Standard API response envelope used by every REST endpoint:
 *   { success, data, message, errors, meta? , code? }
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'TWO_FACTOR_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'OUT_OF_STOCK',
  'PAYMENT_FAILED',
  'KYC_REQUIRED',
  'ACCOUNT_SUSPENDED',
  'BAD_REQUEST',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorDetail {
  /** Dotted path of the offending field, e.g. "items.0.quantity". */
  field?: string;
  code: string;
  message: string;
  /** Extra machine-readable context, e.g. which cart line is out of stock. */
  meta?: Record<string, string>;
}

export interface PageMeta {
  /** Opaque cursor for the next page (cursor pagination); null when there is no more data. */
  nextCursor?: string | null;
  /** Offset pagination fields (admin tables). */
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
  errors: [];
  meta?: PageMeta;
}

export interface ApiFailure {
  success: false;
  data: null;
  message: string;
  errors: ApiErrorDetail[];
  code: ErrorCode;
  /** Correlates with server logs; safe to show to support staff. */
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}
