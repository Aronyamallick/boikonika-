import type { DbOrTx } from '@boikonika/database';
import type { RestrictionScope } from '@boikonika/shared';
import { sql } from 'drizzle-orm';
import { AppException } from '../errors/app-exception';

/** Active moderation restrictions block the action they cover (or everything, for scope "all"). */
export async function assertNotRestricted(tx: DbOrTx, userId: string, scope: Exclude<RestrictionScope, 'all'>): Promise<void> {
  const rows = await tx.execute(sql`
    select 1 from user_restrictions where user_id = ${userId} and lifted_at is null and (until is null or until > now()) and scope in (${scope}, 'all') limit 1`);
  if (rows.rows.length) throw new AppException('FORBIDDEN', 'api.community.restricted');
}
