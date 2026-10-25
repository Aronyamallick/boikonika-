import { Inject, Injectable } from '@nestjs/common';
import { addresses, type Database } from '@boikonika/database';
import type { addressSchema } from '@boikonika/shared';
import { and, count, desc, eq, ne } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';

type AddressInput = z.output<typeof addressSchema>;
const MAX_ADDRESSES = 20;

/** A buyer's saved delivery addresses (orders keep their own snapshot, so edits never rewrite history). */
@Injectable()
export class AddressesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  list(userId: string) {
    return this.db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault), desc(addresses.updatedAt));
  }

  async create(userId: string, input: AddressInput) {
    return this.db.transaction(async (tx) => {
      const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(addresses).where(eq(addresses.userId, userId));
      if (n >= MAX_ADDRESSES) throw new AppException('BAD_REQUEST', 'api.commerce.addressLimit').withParams({ count: MAX_ADDRESSES });
      // The first address is the default one.
      const isDefault = input.isDefault || n === 0;
      if (isDefault) await tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
      const [row] = await tx.insert(addresses).values({ ...input, union: input.union ?? null, postcode: input.postcode ?? null, userId, isDefault }).returning();
      return row!;
    });
  }

  async update(userId: string, id: string, input: AddressInput) {
    return this.db.transaction(async (tx) => {
      if (input.isDefault) await tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true), ne(addresses.id, id)));
      const [current] = await tx.select({ isDefault: addresses.isDefault }).from(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
      if (!current) throw AppException.notFound('Address');
      const [row] = await tx
        .update(addresses)
        .set({ ...input, union: input.union ?? null, postcode: input.postcode ?? null, isDefault: input.isDefault || current.isDefault, updatedAt: new Date() })
        .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
        .returning();
      return row!;
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [removed] = await tx.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId))).returning({ isDefault: addresses.isDefault });
      if (!removed) throw AppException.notFound('Address');
      if (removed.isDefault) {
        // Keep exactly one default while any address remains.
        const [next] = await tx.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.updatedAt)).limit(1);
        if (next) await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
      }
    });
  }
}
