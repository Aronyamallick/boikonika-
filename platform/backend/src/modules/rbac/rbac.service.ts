import { Inject, Injectable } from '@nestjs/common';
import { kycVerifications, rolePermissions, roles as rolesTable, userPermissions, userRoles, users, type Database, type DbOrTx } from '@boikonika/database';
import { KYC_REQUIRED_ROLES, PERMISSION_KEYS, PERMISSIONS, ROLES, type Permission, type Role } from '@boikonika/shared';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';
import { AuditService } from '../audit/audit.service';

const CACHE_TTL_SECONDS = 300;
const VERSION_KEY = 'rbac:version';

/** KYC purpose that must be approved before a capability role is active. */
const KYC_PURPOSE_FOR_ROLE: Partial<Record<Role, 'seller' | 'author' | 'publisher' | 'institution' | 'teacher'>> = {
  author: 'author',
  publisher: 'publisher',
  book_seller: 'seller',
  general_seller: 'seller',
  institution: 'institution',
};

/** Roles, effective permissions (role grants ± per-user overrides) and the guarded admin operations. */
@Injectable()
export class RbacService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly audit: AuditService,
  ) {}

  async rolesOf(userId: string, tx: DbOrTx = this.db): Promise<Role[]> {
    const rows = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
    return rows.map((r) => r.role).sort((a, b) => ROLES.indexOf(a) - ROLES.indexOf(b));
  }

  /** Effective permissions, cached in Redis and invalidated on any role or permission change. */
  async permissionsOf(userId: string): Promise<Permission[]> {
    const cacheKey = `rbac:perm:${userId}`;
    try {
      const [version, cached] = await this.redis.mget(VERSION_KEY, cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { v: string | null; p: Permission[] };
        if (parsed.v === version) return parsed.p;
      }
      const computed = await this.computePermissions(userId);
      await this.redis.set(cacheKey, JSON.stringify({ v: version, p: computed }), 'EX', CACHE_TTL_SECONDS);
      return computed;
    } catch (error) {
      if (error instanceof AppException) throw error;
      return this.computePermissions(userId);
    }
  }

  async can(userId: string, required: readonly Permission[]): Promise<boolean> {
    if (!required.length) return true;
    const granted = new Set(await this.permissionsOf(userId));
    return required.every((p) => granted.has(p));
  }

  async listRoles() {
    const [roleRows, grants, counts] = await Promise.all([
      this.db.select().from(rolesTable),
      this.db.select().from(rolePermissions),
      this.db.select({ role: userRoles.role, users: count() }).from(userRoles).groupBy(userRoles.role),
    ]);
    return roleRows
      .sort((a, b) => ROLES.indexOf(a.key) - ROLES.indexOf(b.key))
      .map((role) => ({
        key: role.key,
        name: role.name,
        description: role.description,
        isStaff: role.isStaff,
        userCount: counts.find((c) => c.role === role.key)?.users ?? 0,
        permissions: role.key === 'super_admin' ? [...PERMISSION_KEYS] : grants.filter((g) => g.role === role.key).map((g) => g.permission),
      }));
  }

  listPermissions() {
    return PERMISSION_KEYS.map((key) => ({ key, description: PERMISSIONS[key] }));
  }

  async grantRole(actorId: string | null, userId: string, role: Role): Promise<void> {
    await this.assertMayChangeRoles(actorId, userId, role);
    const purpose = KYC_PURPOSE_FOR_ROLE[role];
    if (purpose && KYC_REQUIRED_ROLES.includes(role)) {
      const [approved] = await this.db
        .select({ id: kycVerifications.id })
        .from(kycVerifications)
        .where(and(eq(kycVerifications.userId, userId), eq(kycVerifications.purpose, purpose), eq(kycVerifications.status, 'approved')))
        .limit(1);
      if (!approved) throw new AppException('KYC_REQUIRED', 'api.rbac.kycRequired');
    }
    await this.db.transaction(async (tx) => {
      const inserted = await tx.insert(userRoles).values({ userId, role, grantedBy: actorId }).onConflictDoNothing().returning({ role: userRoles.role });
      if (inserted.length) await this.audit.record({ action: 'user.role.grant', entityType: 'user', entityId: userId, after: { role }, actorId }, tx);
    });
    await this.invalidateUser(userId);
  }

  /** Grants a role as part of a system workflow (e.g. KYC approval) — no actor checks. */
  async grantRoleSystem(userId: string, role: Role, tx: DbOrTx = this.db): Promise<void> {
    await tx.insert(userRoles).values({ userId, role }).onConflictDoNothing();
    await this.invalidateUser(userId);
  }

  async revokeRole(actorId: string | null, userId: string, role: Role): Promise<void> {
    await this.assertMayChangeRoles(actorId, userId, role);
    await this.db.transaction(async (tx) => {
      if (role === 'super_admin') {
        // Serialise concurrent demotions so two admins cannot remove each other at the same time.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('rbac:super_admin'))`);
        const [{ total } = { total: 0 }] = await tx.select({ total: count() }).from(userRoles).where(eq(userRoles.role, 'super_admin'));
        if (total <= 1) throw new AppException('CONFLICT', 'api.rbac.lastSuperAdmin');
      }
      const removed = await tx.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role))).returning({ role: userRoles.role });
      if (removed.length) await this.audit.record({ action: 'user.role.revoke', entityType: 'user', entityId: userId, before: { role }, actorId }, tx);
    });
    await this.invalidateUser(userId);
  }

  async setRolePermissions(actorId: string, role: Role, permissionKeys: string[]): Promise<void> {
    if (role === 'super_admin') throw new AppException('BAD_REQUEST', 'api.rbac.superAdminOnly');
    const unknown = permissionKeys.find((p) => !(p in PERMISSIONS));
    if (unknown) throw new AppException('BAD_REQUEST', 'api.rbac.unknownPermission').withParams({ permission: unknown });
    const next = [...new Set(permissionKeys)].sort();
    await this.db.transaction(async (tx) => {
      const before = (await tx.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.role, role))).map((r) => r.p).sort();
      await tx.delete(rolePermissions).where(eq(rolePermissions.role, role));
      if (next.length) await tx.insert(rolePermissions).values(next.map((permission) => ({ role, permission })));
      await this.audit.record({ action: 'role.permissions.update', entityType: 'role', entityId: role, before: { permissions: before }, after: { permissions: next }, actorId }, tx);
    });
    await this.bumpVersion();
  }

  /** Per-user override: `true` grants, `false` denies, `null` removes the override. */
  async setUserPermission(actorId: string, userId: string, permission: Permission, granted: boolean | null): Promise<void> {
    if (actorId === userId) throw new AppException('FORBIDDEN', 'api.rbac.ownRoles');
    if (!(permission in PERMISSIONS)) throw new AppException('BAD_REQUEST', 'api.rbac.unknownPermission').withParams({ permission });
    await this.db.transaction(async (tx) => {
      if (granted === null) {
        await tx.delete(userPermissions).where(and(eq(userPermissions.userId, userId), eq(userPermissions.permission, permission)));
      } else {
        await tx
          .insert(userPermissions)
          .values({ userId, permission, granted, grantedBy: actorId })
          .onConflictDoUpdate({ target: [userPermissions.userId, userPermissions.permission], set: { granted, grantedBy: actorId } });
      }
      await this.audit.record({ action: 'user.permission.set', entityType: 'user', entityId: userId, after: { permission, granted }, actorId }, tx);
    });
    await this.invalidateUser(userId);
  }

  async userPermissionOverrides(userId: string) {
    return this.db.select({ permission: userPermissions.permission, granted: userPermissions.granted }).from(userPermissions).where(eq(userPermissions.userId, userId));
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.redis.del(`rbac:perm:${userId}`).catch(() => undefined);
  }

  private async bumpVersion(): Promise<void> {
    await this.redis.incr(VERSION_KEY).catch(() => undefined);
  }

  private async computePermissions(userId: string): Promise<Permission[]> {
    const roles = await this.rolesOf(userId);
    let granted = new Set<string>();
    if (roles.includes('super_admin')) {
      granted = new Set(PERMISSION_KEYS);
    } else if (roles.length) {
      const rows = await this.db.select({ p: rolePermissions.permission }).from(rolePermissions).where(inArray(rolePermissions.role, roles));
      granted = new Set(rows.map((r) => r.p));
    }
    const overrides = await this.userPermissionOverrides(userId);
    for (const o of overrides) {
      if (o.granted) granted.add(o.permission);
      else if (!roles.includes('super_admin')) granted.delete(o.permission);
    }
    return PERMISSION_KEYS.filter((p) => granted.has(p));
  }

  private async assertMayChangeRoles(actorId: string | null, userId: string, role: Role): Promise<void> {
    if (actorId === null) return;
    if (actorId === userId) throw new AppException('FORBIDDEN', 'api.rbac.ownRoles');
    const actorRoles = await this.rolesOf(actorId);
    const [target] = await this.db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!target) throw AppException.notFound('User');
    if ((role === 'super_admin' || role === 'admin') && !actorRoles.includes('super_admin')) throw new AppException('FORBIDDEN', 'api.rbac.superAdminOnly');
    // Only super admins may change anything about another super admin.
    const targetRoles = await this.rolesOf(userId);
    if (targetRoles.includes('super_admin') && !actorRoles.includes('super_admin')) throw new AppException('FORBIDDEN', 'api.rbac.superAdminOnly');
  }
}
