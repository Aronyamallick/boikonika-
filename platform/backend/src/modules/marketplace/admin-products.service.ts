import { Inject, Injectable } from '@nestjs/common';
import { products, refreshBookOffers, refreshStoreProductCounts, sellers, sellerStores, type Database } from '@boikonika/database';
import type { ProductStatus } from '@boikonika/shared';
import { and, count, desc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

type Decision = 'approve' | 'reject' | 'suspend' | 'restore';

const TRANSITIONS: Record<Decision, { from: ProductStatus[]; to: ProductStatus; notify?: { title: string; body: string } }> = {
  approve: { from: ['pending_review'], to: 'active', notify: { title: 'api.marketplace.listingApprovedTitle', body: 'api.marketplace.listingApprovedBody' } },
  reject: { from: ['pending_review'], to: 'rejected', notify: { title: 'api.marketplace.listingRejectedTitle', body: 'api.marketplace.listingRejectedBody' } },
  suspend: { from: ['active', 'pending_review'], to: 'suspended', notify: { title: 'api.marketplace.listingSuspendedTitle', body: 'api.marketplace.listingSuspendedBody' } },
  restore: { from: ['suspended', 'rejected'], to: 'active' },
};

/** Staff moderation of marketplace listings. */
@Injectable()
export class AdminProductsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(filter: { status?: ProductStatus; q?: string; page: number; pageSize: number }) {
    const where = and(isNull(products.deletedAt), filter.status ? eq(products.status, filter.status) : undefined, filter.q ? ilike(products.title, `%${filter.q.replace(/[%_\\]/g, '')}%`) : undefined);
    const [rows, [{ total } = { total: 0 }]] = await Promise.all([
      this.db
        .select({
          id: products.id,
          slug: products.slug,
          type: products.type,
          title: products.title,
          status: products.status,
          condition: products.condition,
          price: products.price,
          totalStock: products.totalStock,
          rejectionReason: products.rejectionReason,
          createdAt: products.createdAt,
          storeName: sellerStores.name,
          storeSlug: sellerStores.slug,
          imageKey: sql<string | null>`coalesce((select i.storage_key from product_images i where i.product_id = ${products.id} order by i.position limit 1), (select b.cover_key from books b where b.id = ${products.bookId}))`,
        })
        .from(products)
        .innerJoin(sellerStores, eq(sellerStores.sellerId, products.sellerId))
        .where(where)
        .orderBy(filter.status === 'pending_review' ? products.createdAt : desc(products.createdAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db.select({ total: count() }).from(products).where(where),
    ]);
    return {
      items: rows.map(({ imageKey, ...r }) => ({ ...r, createdAt: r.createdAt.toISOString(), imageUrl: this.storage.publicUrl(imageKey) })),
      meta: { page: filter.page, pageSize: filter.pageSize, total },
    };
  }

  async decide(productId: string, decision: Decision, actorId: string, reason?: string) {
    const rule = TRANSITIONS[decision];
    if ((decision === 'reject' || decision === 'suspend') && (!reason || reason.trim().length < 5)) {
      throw AppException.validation([{ field: 'reason', code: 'required', message: 'validation.reasonRequired' }]);
    }
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(products)
        .set({ status: rule.to, rejectionReason: rule.to === 'active' ? null : (reason ?? null), ...(rule.to === 'active' ? { publishedAt: sql`coalesce(${products.publishedAt}, now())` } : {}) })
        .where(and(eq(products.id, productId), inArray(products.status, rule.from), isNull(products.deletedAt)))
        .returning();
      if (!updated) throw new AppException('CONFLICT', 'api.kyc.invalidTransition');
      if (updated.bookId) await refreshBookOffers(tx, [updated.bookId]);
      await refreshStoreProductCounts(tx, [updated.sellerId]);
      await this.audit.record({ action: `listing.${decision}`, entityType: 'product', entityId: productId, after: { status: rule.to, reason }, actorId }, tx);
      if (rule.notify) {
        const [seller] = await tx.select({ userId: sellers.userId }).from(sellers).where(eq(sellers.id, updated.sellerId));
        if (seller) await this.notifications.notify(seller.userId, { type: 'listing', titleKey: rule.notify.title, bodyKey: rule.notify.body, params: { title: updated.title, reason: reason ?? '' }, link: `/seller/products/${productId}` }, tx);
      }
      return { id: updated.id, status: updated.status };
    });
  }
}
