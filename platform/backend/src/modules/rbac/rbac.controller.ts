import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION_KEYS, ROLES, type Permission, type Role } from '@boikonika/shared';
import { z } from 'zod';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { t } from '../../common/i18n';
import { withMessage } from '../../common/http/response';
import { ZodBody } from '../../common/validation/zod';
import { RbacService } from './rbac.service';

const roleParam = z.enum(ROLES);
const permissionList = z.object({ permissions: z.array(z.enum(PERMISSION_KEYS as [Permission, ...Permission[]])).max(PERMISSION_KEYS.length) });
const grantSchema = z.object({ role: roleParam });
const overrideSchema = z.object({ permission: z.enum(PERMISSION_KEYS as [Permission, ...Permission[]]), granted: z.boolean().nullable() });

/** Roles and permissions administration (granular, audited). */
@ApiTags('admin · roles')
@ApiBearerAuth('access-token')
@Controller('admin')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('roles')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Roles with their permissions and member counts' })
  roles() {
    return this.rbac.listRoles();
  }

  @Get('permissions')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'The permission catalogue' })
  permissions() {
    return this.rbac.listPermissions();
  }

  @Put('roles/:role/permissions')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: "Replace a role's permissions (super admin)" })
  async setRolePermissions(@CurrentUser() actor: AuthenticatedUser, @Param('role') role: string, @ZodBody(permissionList) body: z.output<typeof permissionList>) {
    await this.rbac.setRolePermissions(actor.id, roleParam.parse(role), body.permissions);
    return withMessage(null, t('api.rbac.permissionsUpdated'));
  }

  @Get('users/:id/roles')
  @RequirePermissions('users.view')
  @ApiOperation({ summary: "A user's roles and permission overrides" })
  async userRoles(@Param('id', new ParseUUIDPipe()) id: string) {
    const [roles, overrides, permissions] = await Promise.all([this.rbac.rolesOf(id), this.rbac.userPermissionOverrides(id), this.rbac.permissionsOf(id)]);
    return { roles, overrides, permissions };
  }

  @Post('users/:id/roles')
  @HttpCode(200)
  @RequirePermissions('users.roles.manage')
  @ApiOperation({ summary: 'Grant a role (admin/super admin roles need a super admin)' })
  async grant(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(grantSchema) body: { role: Role }) {
    await this.rbac.grantRole(actor.id, id, body.role);
    return withMessage(null, t('api.rbac.roleGranted'));
  }

  @Delete('users/:id/roles/:role')
  @RequirePermissions('users.roles.manage')
  @ApiOperation({ summary: 'Remove a role (the last super admin cannot be removed)' })
  async revoke(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Param('role') role: string) {
    await this.rbac.revokeRole(actor.id, id, roleParam.parse(role));
    return withMessage(null, t('api.rbac.roleRevoked'));
  }

  @Put('users/:id/permissions')
  @RequirePermissions('users.roles.manage', 'roles.manage')
  @ApiOperation({ summary: 'Grant or deny one permission for one user (null clears the override)' })
  async override(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(overrideSchema) body: z.output<typeof overrideSchema>) {
    await this.rbac.setUserPermission(actor.id, id, body.permission, body.granted);
    return withMessage(null, t('api.rbac.permissionsUpdated'));
  }
}
