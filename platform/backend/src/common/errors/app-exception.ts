import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorDetail, ErrorCode } from '@boikonika/shared';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  TOKEN_EXPIRED: HttpStatus.UNAUTHORIZED,
  TWO_FACTOR_REQUIRED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  KYC_REQUIRED: HttpStatus.FORBIDDEN,
  ACCOUNT_SUSPENDED: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  OUT_OF_STOCK: HttpStatus.CONFLICT,
  PAYMENT_FAILED: HttpStatus.PAYMENT_REQUIRED,
  PAYLOAD_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  UNSUPPORTED_MEDIA_TYPE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * The only exception type services should throw for expected failures. `message` is
 * user-facing (keep it friendly); never put secrets or internal details in it.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: ApiErrorDetail[] = [],
    status: number = STATUS_BY_CODE[code],
  ) {
    super({ code, message, details }, status);
  }

  static notFound(what = 'Resource'): AppException {
    return new AppException('NOT_FOUND', `${what} not found`);
  }

  static forbidden(message = "You don't have permission to do that"): AppException {
    return new AppException('FORBIDDEN', message);
  }

  static conflict(message: string, field?: string): AppException {
    return new AppException('CONFLICT', message, field ? [{ field, code: 'conflict', message }] : []);
  }

  static badRequest(message: string, field?: string): AppException {
    return new AppException('BAD_REQUEST', message, field ? [{ field, code: 'invalid', message }] : []);
  }

  static validation(details: ApiErrorDetail[], message = 'Please fix the highlighted fields'): AppException {
    return new AppException('VALIDATION_FAILED', message, details);
  }
}

export const statusForCode = (code: ErrorCode): number => STATUS_BY_CODE[code];
