import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiErrorDetail, ApiFailure, ErrorCode } from '@boikonika/shared';
import type { Response } from 'express';
import { AppException } from '../errors/app-exception';
import type { RequestWithContext } from './request-id.middleware';

interface PgError {
  code?: string;
  constraint?: string;
  detail?: string;
  column?: string;
}

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

const FRIENDLY: Partial<Record<ErrorCode, string>> = {
  UNAUTHORIZED: 'Please log in to continue',
  FORBIDDEN: "You don't have permission to do that",
  NOT_FOUND: 'Not found',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again',
  INTERNAL: 'Something went wrong on our side. Please try again',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable',
};

/**
 * Converts every error into the standard failure envelope. Stack traces and database
 * internals are logged (with the request id) but never sent to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithContext>();
    if (res.headersSent) return;

    const { status, code, message, details } = this.describe(exception, req);
    const body: ApiFailure = { success: false, data: null, message, errors: details, code, requestId: req.requestId };
    if (status === 429 && !res.getHeader('Retry-After')) res.setHeader('Retry-After', '60');
    res.status(status).json(body);
  }

  private describe(exception: unknown, req: RequestWithContext): { status: number; code: ErrorCode; message: string; details: ApiErrorDetail[] } {
    if (exception instanceof AppException) {
      return { status: exception.getStatus(), code: exception.code, message: exception.message, details: exception.details };
    }
    if (exception instanceof ThrottlerException) {
      return { status: 429, code: 'RATE_LIMITED', message: FRIENDLY.RATE_LIMITED!, details: [] };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST');
      const response = exception.getResponse();
      let message = typeof response === 'string' ? response : (response as { message?: string | string[] }).message ?? exception.message;
      if (Array.isArray(message)) message = message.join('; ');
      if (status >= 500) {
        this.logger.error(`[${req.requestId}] ${exception.message}`, exception.stack);
        message = FRIENDLY.INTERNAL!;
      }
      // Express' body parser reports malformed JSON / oversize bodies as HttpExceptions too.
      return { status, code, message: message || FRIENDLY[code] || 'Request failed', details: [] };
    }
    const pg = exception as PgError;
    if (pg && typeof pg.code === 'string' && /^[0-9A-Z]{5}$/.test(pg.code)) {
      const mapped = this.mapPostgres(pg);
      if (mapped) return mapped;
    }
    const err = exception as Error;
    if ((err as { type?: string })?.type === 'entity.too.large') {
      return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large', details: [] };
    }
    this.logger.error(`[${req.requestId}] Unhandled ${err?.name ?? 'error'}: ${err?.message ?? String(exception)}`, err?.stack);
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL', message: FRIENDLY.INTERNAL!, details: [] };
  }

  /** PostgreSQL error codes → client errors (constraint names follow `<table>_<cols>_<kind>`). */
  private mapPostgres(pg: PgError) {
    const field = pg.constraint?.replace(/_(key|unique|uq|idx|fkey|check|chk)$/, '').split('_').slice(1).join('_') || undefined;
    switch (pg.code) {
      case '23505':
        return { status: 409, code: 'CONFLICT' as const, message: 'This already exists', details: [{ field, code: 'unique', message: 'Already in use' }] };
      case '23503':
        return { status: 409, code: 'CONFLICT' as const, message: 'A related record is missing or still in use', details: [{ field, code: 'reference', message: 'Related record problem' }] };
      case '23514':
      case '23502':
        return { status: 400, code: 'VALIDATION_FAILED' as const, message: 'Some values are not allowed', details: [{ field: pg.column ?? field, code: 'constraint', message: 'Not allowed' }] };
      case '22P02':
      case '22003':
      case '22007':
        return { status: 400, code: 'BAD_REQUEST' as const, message: 'Invalid value in request', details: [] };
      case '40001':
      case '40P01':
        return { status: 409, code: 'CONFLICT' as const, message: 'Please retry — the record changed while we were saving it', details: [] };
      default:
        return null;
    }
  }
}
