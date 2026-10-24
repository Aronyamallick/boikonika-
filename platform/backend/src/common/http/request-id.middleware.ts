import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface RequestWithContext extends Request {
  requestId: string;
  user?: { id: string };
}

const SAFE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Assigns a request id (honouring a well-formed X-Request-Id from the proxy) and logs one line per request. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    (req as RequestWithContext).requestId = id;
    res.setHeader('X-Request-Id', id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const user = (req as RequestWithContext).user?.id ?? '-';
      const line = `${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(1)}ms req=${id} user=${user}`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (process.env.NODE_ENV !== 'test') this.logger.log(line);
    });
    next();
  }
}
