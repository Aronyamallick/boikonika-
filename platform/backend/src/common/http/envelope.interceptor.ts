import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import { isEnvelopeParts } from './response';

/** Wraps every successful JSON response as { success, data, message, errors, meta? }. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((body: unknown) => {
        if (body instanceof StreamableFile || res.headersSent || res.statusCode === 204) return body;
        // A handler may set an error status itself (e.g. the health probe's 503) and still return a body.
        const success = res.statusCode < 400;
        if (isEnvelopeParts(body)) {
          return { success, data: body.data ?? null, message: body.message ?? '', errors: [], ...(body.meta ? { meta: body.meta } : {}) };
        }
        return { success, data: body ?? null, message: '', errors: [] };
      }),
    );
  }
}
