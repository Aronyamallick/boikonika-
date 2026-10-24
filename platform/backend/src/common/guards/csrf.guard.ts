import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../errors/app-exception';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';

/**
 * For endpoints authenticated by the refresh cookie (refresh, logout): browsers must send the custom
 * `X-Requested-With` header (which forces a CORS preflight) and, when present, an allowed Origin.
 * A cross-site form or image request therefore cannot use the cookie. Mobile clients send the
 * refresh token in the body and are unaffected.
 */
@Injectable()
export class CookieCsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const usesCookie = !req.body?.refreshToken && !!req.cookies?.bk_refresh;
    if (!usesCookie) return true;
    const origin = req.header('origin');
    const allowedOrigin = !origin || this.config.CORS_ORIGINS.includes(origin) || origin === this.config.APP_URL;
    if (req.header('x-requested-with') !== 'boikonika' || !allowedOrigin) throw new AppException('FORBIDDEN', 'api.auth.csrf');
    return true;
  }
}
