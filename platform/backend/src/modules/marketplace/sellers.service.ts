import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { authors, publishers, sellers, sellerStores, users, type Database, type DbOrTx } from '@boikonika/database';
import { isDistrictInDivision, slugify, slugSuffix, storeSettingsSchema } from '@boikonika/shared';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { processUpload } from '../../infra/storage/uploads';
import { AuditService } from '../audit/audit.service';
import { KycService } from '../kyc/kyc.service';

export type SellerRow = typeof sellers.$inferSelect;
type StoreSettings = z.output<typeof storeSettingsSchema>;

/** Finds a free slug in `table.slug`, adding a short random suffix when the plain one is taken. */
export async function uniqueSlug(tx: DbOrTx, table: 'books' | 'authors' | 'publishers' | 'seller_stores' | 'products' | 'book_clubs' | 'quizzes', base: string): Promise<string> {
  const root = slugify(base, 60);
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 && table !== 'products' ? root : `${root}-${slugSuffix(i < 3 ? 4 : 8)}`;
    const taken = await tx.execute(sql`select 1 from ${sql.identifier(table)} where slug = ${candidate} limit 1`);
    if (!taken.rows.length) return candidate;
  }
  return `${root}-${randomUUID().slice(0, 8)}`;
}

/**
 * Seller accounts and stores. Approving a seller, publisher or author verification provisions what
 * that role needs: a seller account with a store, a verified publisher profile, or a claimed author
 * profile.
 */
@Injectable()
export class SellersService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly kyc: KycService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.kyc.onApproved(async (verification, tx) => {
      const role = verification.requestedRole;
      const orgName = verification.businessName ?? verification.institutionName ?? verification.legalName;
      if (role === 'book_seller' || role === 'general_seller' || role === 'publisher') {
        const [existing] = await tx.select().from(sellers).where(eq(sellers.userId, verification.userId));
        let sellerId = existing?.id;
        if (!existing) {
          const [created] = await tx
            .insert(sellers)
            .values({ userId: verification.userId, type: role, status: 'active', kycVerificationId: verification.id, approvedAt: new Date() })
            .returning({ id: sellers.id });
          sellerId = created!.id;
        } else if (existing.status === 'pending' || existing.status === 'closed') {
          await tx.update(sellers).set({ status: 'active', approvedAt: new Date(), kycVerificationId: verification.id }).where(eq(sellers.id, existing.id));
        }
        const [store] = await tx.select({ id: sellerStores.id }).from(sellerStores).where(eq(sellerStores.sellerId, sellerId!));
        if (!store) {
          await tx.insert(sellerStores).values({ sellerId: sellerId!, name: orgName.slice(0, 160), slug: await uniqueSlug(tx, 'seller_stores', orgName) });
        }
      }
      if (role === 'publisher') {
        const [owned] = await tx.select({ id: publishers.id }).from(publishers).where(eq(publishers.ownerId, verification.userId));
        if (!owned) {
          await tx.insert(publishers).values({ ownerId: verification.userId, name: orgName.slice(0, 200), slug: await uniqueSlug(tx, 'publishers', orgName), isVerified: true });
        }
      }
      if (role === 'author') {
        const [claimed] = await tx.select({ id: authors.id }).from(authors).where(eq(authors.userId, verification.userId));
        if (!claimed) {
          const [user] = await tx.select({ displayName: users.displayName }).from(users).where(eq(users.id, verification.userId));
          const name = user?.displayName ?? verification.legalName;
          await tx.insert(authors).values({ userId: verification.userId, name: name.slice(0, 160), slug: await uniqueSlug(tx, 'authors', name), isVerified: true });
        }
      }
    });
  }

  /** The caller's active seller account, or a clear error. */
  async requireSeller(userId: string): Promise<SellerRow> {
    const [seller] = await this.db.select().from(sellers).where(eq(sellers.userId, userId));
    if (!seller || seller.status === 'pending' || seller.status === 'closed') throw new AppException('FORBIDDEN', 'api.marketplace.notSeller');
    if (seller.status === 'suspended') throw new AppException('FORBIDDEN', 'api.marketplace.sellerSuspended');
    return seller;
  }

  async me(userId: string) {
    const seller = await this.requireSeller(userId);
    const [store] = await this.db.select().from(sellerStores).where(eq(sellerStores.sellerId, seller.id));
    return {
      id: seller.id,
      type: seller.type,
      status: seller.status,
      commissionPercent: seller.commissionPercent,
      approvedAt: seller.approvedAt?.toISOString() ?? null,
      store: store
        ? {
            slug: store.slug,
            name: store.name,
            tagline: store.tagline,
            description: store.description,
            phone: store.phone,
            email: store.email,
            division: store.division,
            district: store.district,
            address: store.address,
            returnPolicy: store.returnPolicy,
            shippingPolicy: store.shippingPolicy,
            logoUrl: this.storage.publicUrl(store.logoKey),
            bannerUrl: this.storage.publicUrl(store.bannerKey),
            productCount: store.productCount,
            ratingAvg: Number(store.ratingAvg),
          }
        : null,
    };
  }

  async updateStore(userId: string, input: StoreSettings) {
    const seller = await this.requireSeller(userId);
    if (input.district && input.division === undefined) {
      // A district alone must still sit inside the store's current division.
      const [store] = await this.db.select({ division: sellerStores.division }).from(sellerStores).where(eq(sellerStores.sellerId, seller.id));
      if (store?.division && !isDistrictInDivision(store.division, input.district)) {
        throw AppException.validation([{ field: 'district', code: 'invalid_choice', message: 'validation.invalidChoice' }]);
      }
    }
    const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length) {
      await this.db.update(sellerStores).set(changes).where(eq(sellerStores.sellerId, seller.id));
      await this.audit.record({ action: 'store.update', entityType: 'seller', entityId: seller.id, after: changes });
    }
    return this.me(userId);
  }

  async setStoreImage(userId: string, kind: 'logo' | 'banner', file: Buffer) {
    const seller = await this.requireSeller(userId);
    const processed = await processUpload(file, {
      allowed: ['image/jpeg', 'image/png', 'image/webp'],
      maxBytes: 5 * 1024 * 1024,
      image: kind === 'logo' ? { maxWidth: 400, maxHeight: 400, format: 'webp', crop: true } : { maxWidth: 1600, maxHeight: 500, format: 'webp', crop: true },
    });
    const key = `stores/${seller.id}/${kind}-${randomUUID()}.webp`;
    await this.storage.put('public', key, processed.body, processed.contentType);
    const [store] = await this.db.select({ logoKey: sellerStores.logoKey, bannerKey: sellerStores.bannerKey }).from(sellerStores).where(eq(sellerStores.sellerId, seller.id));
    await this.db.update(sellerStores).set(kind === 'logo' ? { logoKey: key } : { bannerKey: key }).where(eq(sellerStores.sellerId, seller.id));
    const previous = kind === 'logo' ? store?.logoKey : store?.bannerKey;
    if (previous) await this.storage.delete('public', previous);
    return { url: this.storage.publicUrl(key) };
  }
}
