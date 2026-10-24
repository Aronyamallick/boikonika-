import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { AppException } from '../errors/app-exception';
import { requestContext } from '../context/request-context';
import type { RequestWithContext } from '../http/request-id.middleware';
import { SessionsService } from '../../modules/auth/sessions.service';
import { TokenService } from '../../modules/auth/token.service';

/**
 * Global guard: every route needs a valid access token unless marked @Public(). A token is valid when
 * its signature and expiry check out and its session has not been revoked (logout, password change,
 * ban, refresh-token theft). Public routes still get `req.user` when a valid token is sent.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;

    if (!token) {
      if (isPublic) return true;
      throw new AppException('UNAUTHORIZED', 'errors.unauthorized');
    }
    const verified = this.tokens.verifyAccess(token);
    if (!verified.ok) {
      if (isPublic) return true;
      throw verified.reason === 'expired' ? new AppException('TOKEN_EXPIRED', 'api.auth.sessionExpired') : new AppException('UNAUTHORIZED', 'errors.unauthorized');
    }
    if (!(await this.sessions.isActive(verified.claims.sid))) {
      if (isPublic) return true;
      throw new AppException('UNAUTHORIZED', 'api.auth.sessionExpired');
    }
    req.user = { id: verified.claims.sub, sessionId: verified.claims.sid };
    requestContext.setUser(verified.claims.sub, verified.claims.sid);
    return true;
  }
}
