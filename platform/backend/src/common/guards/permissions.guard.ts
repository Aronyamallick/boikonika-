import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission, Role } from '@boikonika/shared';
import { REQUIRED_PERMISSIONS, REQUIRED_ROLES } from '../decorators/auth.decorators';
import { AppException } from '../errors/app-exception';
import type { RequestWithContext } from '../http/request-id.middleware';
import { RbacService } from '../../modules/rbac/rbac.service';

/** Enforces @RequirePermissions (all) and @RequireRoles (any) after authentication. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    const permissions = this.reflector.getAllAndMerge<Permission[]>(REQUIRED_PERMISSIONS, targets) ?? [];
    const roles = this.reflector.getAllAndMerge<Role[]>(REQUIRED_ROLES, targets) ?? [];
    if (!permissions.length && !roles.length) return true;
    const user = context.switchToHttp().getRequest<RequestWithContext>().user;
    if (!user) throw new AppException('UNAUTHORIZED', 'errors.unauthorized');
    if (roles.length) {
      const held = await this.rbac.rolesOf(user.id);
      if (!roles.some((r) => held.includes(r))) throw new AppException('FORBIDDEN', 'errors.forbidden');
    }
    if (permissions.length && !(await this.rbac.can(user.id, permissions))) throw new AppException('FORBIDDEN', 'errors.forbidden');
    return true;
  }
}
