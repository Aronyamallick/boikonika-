import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission, Role } from '@boikonika/shared';
import type { RequestWithContext } from '../http/request-id.middleware';

export const REQUIRED_PERMISSIONS = 'requiredPermissions';
export const REQUIRED_ROLES = 'requiredRoles';

/** The caller needs every listed permission (checked on the server for every request). */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);

/** The caller needs at least one of the listed roles. */
export const RequireRoles = (...roles: Role[]) => SetMetadata(REQUIRED_ROLES, roles);

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
}

/** `@CurrentUser() user` — the signed-in user (routes are private by default, so it is always set there). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
  return ctx.switchToHttp().getRequest<RequestWithContext>().user;
});
