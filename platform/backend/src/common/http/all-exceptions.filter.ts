import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiErrorDetail, ApiFailure, ErrorCode } from '@boikonika/shared';
import type { Response } from 'express';
import { AppException } from '../errors/app-exception';
import { pgErrorOf, type PgError } from '../errors/pg';
import { t } from '../i18n';
import type { RequestWithContext } from './request-id.middleware';

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

/** Message keys (shared i18n) for errors raised outside our own services. */
const FRIENDLY: Partial<Record<ErrorCode, string>> = {
  UNAUTHORIZED: 'errors.unauthorized',
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  CONFLICT: 'errors.conflict',
  VALIDATION_FAILED: 'errors.validation',
  RATE_LIMITED: 'errors.rateLimited',
  INTERNAL: 'errors.server',
  SERVICE_UNAVAILABLE: 'errors.generic',
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
    const params = exception instanceof AppException ? exception.params : undefined;
    // Messages and field errors are i18n keys where possible; translate them for the caller.
    const errors = details.map((d) => ({ ...d, message: t(d.message, params) }));
    const body: ApiFailure = { success: false, data: null, message: t(message, params), errors, code, requestId: req.requestId };
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
    const parserType = (exception as { type?: string; cause?: { type?: string } })?.type ?? (exception as { cause?: { type?: string } })?.cause?.type;
    if (parserType === 'entity.parse.failed') return { status: 400, code: 'BAD_REQUEST', message: 'errors.badJson', details: [] };
    if (parserType === 'entity.too.large') return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'errors.tooLarge', details: [] };
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
      // Framework messages ("Cannot GET /x", guard denials) are English-only; prefer our translated text.
      if (status === 401 || status === 403 || status === 404) message = FRIENDLY[code]!;
      // Express' body parser reports malformed JSON / oversize bodies as HttpExceptions too.
      return { status, code, message: message || FRIENDLY[code] || 'errors.generic', details: [] };
    }
    const pg = pgErrorOf(exception);
    if (pg) {
      const mapped = this.mapPostgres(pg);
      if (mapped) return mapped;
    }
    const err = exception as Error;
    if ((err as { type?: string })?.type === 'entity.parse.failed') {
      return { status: 400, code: 'BAD_REQUEST', message: 'errors.badJson', details: [] };
    }
    if ((err as { type?: string })?.type === 'entity.too.large') {
      return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'errors.tooLarge', details: [] };
    }
    this.logger.error(`[${req.requestId}] Unhandled ${err?.name ?? 'error'}: ${err?.message ?? String(exception)}`, err?.stack);
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL', message: FRIENDLY.INTERNAL!, details: [] };
  }

  /** PostgreSQL error codes → client errors (constraint names follow `<table>_<cols>_<kind>`). */
  private mapPostgres(pg: PgError) {
    const field = pg.constraint?.replace(/_(key|unique|uq|idx|fkey|check|chk)$/, '').split('_').slice(1).join('_') || undefined;
    switch (pg.code) {
      case '23505':
        return { status: 409, code: 'CONFLICT' as const, message: 'errors.conflict', details: [{ field, code: 'unique', message: 'errors.conflict' }] };
      case '23503':
        return { status: 409, code: 'CONFLICT' as const, message: 'errors.conflict', details: [{ field, code: 'reference', message: 'errors.conflict' }] };
      case '23514':
      case '23502':
        return { status: 400, code: 'VALIDATION_FAILED' as const, message: 'errors.validation', details: [{ field: pg.column ?? field, code: 'constraint', message: 'errors.validation' }] };
      case '22P02':
      case '22003':
      case '22007':
        return { status: 400, code: 'BAD_REQUEST' as const, message: 'errors.validation', details: [] };
      case '40001':
      case '40P01':
        return { status: 409, code: 'CONFLICT' as const, message: 'errors.retry', details: [] };
      default:
        return null;
    }
  }
}
