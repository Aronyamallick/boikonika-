import { Inject, Injectable } from '@nestjs/common';
import { auditLogs, type Database, type DbOrTx } from '@boikonika/database';
import { requestContext } from '../../common/context/request-context';
import { DB } from '../../infra/database/database.module';

export interface AuditEntry {
  /** Dotted verb, e.g. "user.role.grant", "kyc.approve", "settings.update". */
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Defaults to the signed-in user of the current request; null for system actions. */
  actorId?: string | null;
}

/** Append-only audit trail (UPDATE/DELETE are rejected by a database trigger). */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(entry: AuditEntry, tx: DbOrTx = this.db): Promise<void> {
    const ctx = requestContext.get();
    await tx.insert(auditLogs).values({
      actorId: entry.actorId === undefined ? (ctx?.userId ?? null) : entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      requestId: ctx?.requestId ?? null,
    });
  }
}
