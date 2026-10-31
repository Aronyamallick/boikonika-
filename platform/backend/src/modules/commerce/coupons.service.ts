import { Inject, Injectable } from '@nestjs/common';
import { coupons, type Database } from '@boikonika/database';
import type { couponSchema } from '@boikonika/shared';
import { desc, eq, ilike, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { isUniqueViolation } from '../../common/errors/pg';
import { DB } from '../../infra/database/database.module';
import { AuditService } from '../audit/audit.service';

type CouponInput = z.output<typeof couponSchema>;

/** Platform coupons managed by staff (seller coupons are created from the seller centre). */
@Injectable()
export class CouponsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(q: { q?: string; page: number; pageSize: number }) {
    const where = q.q ? ilike(sql`${coupons.code}::text`, `%${q.q.replace(/[%_\\]/g, '')}%`) : undefined;
    const [items, [{ total } = { total: 0 }]] = await Promise.all([
      this.db.select().from(coupons).where(where).orderBy(desc(coupons.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
      this.db.select({ total: sql<number>`count(*)::int` }).from(coupons).where(where),
    ]);
    return { items, meta: { page: q.page, pageSize: q.pageSize, total } };
  }

  async create(actorId: string, input: CouponInput) {
    try {
      const [row] = await this.db.insert(coupons).values({ ...input, maxDiscountAmount: input.maxDiscountAmount ?? null, usageLimit: input.usageLimit ?? null, description: input.description ?? null, createdBy: actorId }).returning();
      await this.audit.record({ action: 'coupon.create', entityType: 'coupon', entityId: row!.id, after: { code: row!.code, type: row!.type, value: row!.value } });
      return row!;
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppException('CONFLICT', 'api.commerce.couponExists', [{ field: 'code', code: 'exists', message: 'api.commerce.couponExists' }]);
      throw error;
    }
  }

  async update(id: string, input: CouponInput) {
    const [before] = await this.db.select().from(coupons).where(eq(coupons.id, id));
    if (!before) throw AppException.notFound('Coupon');
    if (input.usageLimit !== undefined && input.usageLimit < before.usedCount) {
      throw AppException.validation([{ field: 'usageLimit', code: 'below_used', message: 'api.commerce.couponLimitBelowUsed' }]);
    }
    try {
      const [row] = await this.db
        .update(coupons)
        .set({ ...input, maxDiscountAmount: input.maxDiscountAmount ?? null, usageLimit: input.usageLimit ?? null, description: input.description ?? null, updatedAt: new Date() })
        .where(eq(coupons.id, id))
        .returning();
      await this.audit.record({ action: 'coupon.update', entityType: 'coupon', entityId: id, before: { code: before.code, isActive: before.isActive, value: before.value }, after: { code: row!.code, isActive: row!.isActive, value: row!.value } });
      return row!;
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppException('CONFLICT', 'api.commerce.couponExists', [{ field: 'code', code: 'exists', message: 'api.commerce.couponExists' }]);
      throw error;
    }
  }
}
