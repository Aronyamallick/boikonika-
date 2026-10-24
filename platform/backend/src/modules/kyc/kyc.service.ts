import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { kycDocuments, kycEvents, kycVerifications, userRoles, users, type Database, type DbOrTx } from '@boikonika/database';
import {
  isValidNid,
  KYC_NUMBERED_DOCUMENTS,
  KYC_REQUIREMENTS,
  KYC_UPLOAD,
  kycSubmitSchema,
  missingKycDocuments,
  translate,
  type KycStatus,
  type Role,
} from '@boikonika/shared';
import { and, asc, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { isUniqueViolation } from '../../common/errors/pg';
import { CryptoService } from '../../infra/crypto/crypto.service';
import { DB } from '../../infra/database/database.module';
import { StorageService } from '../../infra/storage/storage.service';
import { processUpload } from '../../infra/storage/uploads';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RbacService } from '../rbac/rbac.service';
import { SettingsService } from '../settings/settings.service';

type SubmitInput = z.output<typeof kycSubmitSchema>;
type Verification = typeof kycVerifications.$inferSelect;
export type ApprovalListener = (verification: Verification, tx: DbOrTx) => Promise<void>;

const OPEN: KycStatus[] = ['pending', 'under_review'];

/**
 * Identity verification (KYC). Documents go to the private bucket only, document numbers are
 * AES-256-GCM encrypted (last 4 kept for display), every status change and every document view is an
 * append-only kyc_event, and documents are purged when the retention period ends.
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger('KYC');
  private readonly approvalListeners: ApprovalListener[] = [];

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly crypto: CryptoService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  /** Other modules react to approvals (e.g. the marketplace opens a seller account). */
  onApproved(listener: ApprovalListener): void {
    this.approvalListeners.push(listener);
  }

  async submit(userId: string, input: SubmitInput, files: Buffer[]) {
    const requirement = KYC_REQUIREMENTS[input.purpose];
    if (!requirement.roles.includes(input.requestedRole)) throw new AppException('BAD_REQUEST', 'api.kyc.roleNotAllowed', [{ field: 'requestedRole', code: 'invalid', message: 'api.kyc.roleNotAllowed' }]);
    if (files.length !== input.documents.length) throw AppException.validation([{ field: 'documents', code: 'mismatch', message: 'api.kyc.documentsMismatch' }]);
    const missing = missingKycDocuments(input.purpose, input.documents.map((d) => d.type));
    if (missing.length) throw AppException.validation([{ field: 'documents', code: 'missing', message: 'validation.fileMissing' }]);
    if (requirement.needsOrganisation && !(input.businessName || input.institutionName)) {
      throw AppException.validation([{ field: input.purpose === 'institution' ? 'institutionName' : 'businessName', code: 'required', message: 'api.kyc.organisationRequired' }]);
    }
    // Any number given must be valid; each numbered document type needs its number at least once
    // (e.g. on the front of an NID card, not necessarily on the back).
    input.documents.forEach((doc, i) => {
      if (doc.type === 'nid' && doc.number && !isValidNid(doc.number)) throw AppException.validation([{ field: `documents.${i}.number`, code: 'invalid', message: 'api.kyc.invalidNid' }]);
    });
    for (const type of ['nid', 'passport', 'driving_license', 'trade_license'] as const) {
      const ofType = input.documents.map((d, i) => ({ d, i })).filter(({ d }) => d.type === type);
      if (ofType.length && !ofType.some(({ d }) => d.number)) {
        throw AppException.validation([{ field: `documents.${ofType[0]!.i}.number`, code: 'required', message: type === 'nid' ? 'api.kyc.invalidNid' : 'api.kyc.documentNumberRequired' }]);
      }
    }
    const [held] = await this.db.select({ role: userRoles.role }).from(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, input.requestedRole)));
    const [approved] = await this.db
      .select({ id: kycVerifications.id })
      .from(kycVerifications)
      .where(and(eq(kycVerifications.userId, userId), eq(kycVerifications.requestedRole, input.requestedRole), eq(kycVerifications.status, 'approved')));
    if (held && approved) throw new AppException('CONFLICT', 'api.kyc.alreadyVerified');

    // Validate and store the files first; if saving the request fails they are removed again.
    const processed = await Promise.all(files.map((file) => processUpload(file, { allowed: KYC_UPLOAD.mimeTypes, maxBytes: KYC_UPLOAD.maxBytes, image: { maxWidth: 2400, maxHeight: 2400, format: 'jpeg', quality: 88 } })));
    const verificationId = randomUUID();
    const stored = processed.map((p) => ({ ...p, key: `kyc/${userId}/${verificationId}/${randomUUID()}.${p.extension}` }));
    await Promise.all(stored.map((s) => this.storage.put('private', s.key, s.body, s.contentType)));

    try {
      return await this.db.transaction(async (tx) => {
        const [previous] = await tx
          .select({ id: kycVerifications.id })
          .from(kycVerifications)
          .where(and(eq(kycVerifications.userId, userId), eq(kycVerifications.purpose, input.purpose), inArray(kycVerifications.status, ['rejected', 'resubmission_required'])))
          .orderBy(desc(kycVerifications.submittedAt))
          .limit(1);
        const [verification] = await tx
          .insert(kycVerifications)
          .values({
            id: verificationId,
            userId,
            purpose: input.purpose,
            requestedRole: input.requestedRole,
            legalName: input.legalName,
            dateOfBirth: input.dateOfBirth ?? null,
            businessName: input.businessName ?? null,
            institutionName: input.institutionName ?? null,
            address: input.address ?? null,
            declarations: input.declarations,
            previousVerificationId: previous?.id ?? null,
          })
          .returning();
        await tx.insert(kycDocuments).values(
          input.documents.map((doc, i) => {
            const numbered = !!doc.number && KYC_NUMBERED_DOCUMENTS.includes(doc.type);
            return {
              verificationId,
              type: doc.type,
              side: doc.side,
              storageKey: stored[i]!.key,
              mimeType: stored[i]!.contentType,
              sizeBytes: stored[i]!.body.length,
              sha256: stored[i]!.sha256,
              documentNumberEnc: numbered ? this.crypto.encrypt(doc.number!) : null,
              documentNumberLast4: numbered ? doc.number!.slice(-4) : null,
              expiresOn: doc.expiresOn ?? null,
            };
          }),
        );
        await tx.insert(kycEvents).values({ verificationId, actorId: userId, event: 'submitted', toStatus: 'pending' });
        await this.audit.record({ action: 'kyc.submit', entityType: 'kyc_verification', entityId: verificationId, after: { purpose: input.purpose, role: input.requestedRole, documents: input.documents.map((d) => d.type) }, actorId: userId }, tx);
        return this.presentForOwner(verification!, await this.documentsOf(tx, [verificationId]), []);
      });
    } catch (error) {
      await Promise.all(stored.map((s) => this.storage.delete('private', s.key)));
      if (isUniqueViolation(error, 'kyc_verifications_open_unique')) throw new AppException('CONFLICT', 'api.kyc.alreadyOpen');
      throw error;
    }
  }

  async listMine(userId: string) {
    const rows = await this.db.select().from(kycVerifications).where(eq(kycVerifications.userId, userId)).orderBy(desc(kycVerifications.submittedAt));
    const ids = rows.map((r) => r.id);
    const [docs, events] = await Promise.all([this.documentsOf(this.db, ids), ids.length ? this.db.select().from(kycEvents).where(inArray(kycEvents.verificationId, ids)).orderBy(asc(kycEvents.createdAt)) : []]);
    return rows.map((r) => this.presentForOwner(r, docs, events));
  }

  // ----------------------------------------------------------------- staff review

  async list(filter: { status?: KycStatus; purpose?: string; page: number; pageSize: number }) {
    const where = and(filter.status ? eq(kycVerifications.status, filter.status) : undefined, filter.purpose ? sql`${kycVerifications.purpose} = ${filter.purpose}` : undefined);
    const [rows, [{ total } = { total: 0 }]] = await Promise.all([
      this.db
        .select({ v: kycVerifications, username: users.username, displayName: users.displayName })
        .from(kycVerifications)
        .innerJoin(users, eq(users.id, kycVerifications.userId))
        .where(where)
        .orderBy(asc(kycVerifications.submittedAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db.select({ total: count() }).from(kycVerifications).where(where),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.v.id,
        purpose: r.v.purpose,
        requestedRole: r.v.requestedRole,
        status: r.v.status,
        legalName: r.v.legalName,
        businessName: r.v.businessName ?? r.v.institutionName,
        submittedAt: r.v.submittedAt.toISOString(),
        user: { id: r.v.userId, username: r.username, displayName: r.displayName },
      })),
      meta: { page: filter.page, pageSize: filter.pageSize, total },
    };
  }

  async detail(id: string) {
    const verification = await this.get(id);
    const [user] = await this.db
      .select({ id: users.id, username: users.username, displayName: users.displayName, email: users.email, phone: users.phone, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, verification.userId));
    const [docs, events, history] = await Promise.all([
      this.documentsOf(this.db, [id]),
      this.db.select().from(kycEvents).where(eq(kycEvents.verificationId, id)).orderBy(asc(kycEvents.createdAt)),
      this.db
        .select({ id: kycVerifications.id, status: kycVerifications.status, submittedAt: kycVerifications.submittedAt, rejectionReason: kycVerifications.rejectionReason })
        .from(kycVerifications)
        .where(and(eq(kycVerifications.userId, verification.userId), eq(kycVerifications.purpose, verification.purpose)))
        .orderBy(desc(kycVerifications.submittedAt)),
    ]);
    return {
      ...this.presentForOwner(verification, docs, events),
      address: verification.address,
      dateOfBirth: verification.dateOfBirth,
      declarations: verification.declarations,
      reviewNote: verification.reviewNote,
      // Staff see the full trail, including who opened which document.
      events: events.map((e) => ({ event: e.event, fromStatus: e.fromStatus, toStatus: e.toStatus, actorId: e.actorId, note: e.note, at: e.createdAt.toISOString() })),
      user: user ? { ...user, createdAt: user.createdAt.toISOString() } : null,
      history: history.map((h) => ({ ...h, submittedAt: h.submittedAt.toISOString() })),
    };
  }

  /** Short-lived link to one document plus its full number; the view itself is recorded. */
  async openDocument(verificationId: string, documentId: string, actorId: string) {
    const verification = await this.get(verificationId);
    if (verification.userId === actorId) throw new AppException('FORBIDDEN', 'api.kyc.selfReview');
    const [doc] = await this.db.select().from(kycDocuments).where(and(eq(kycDocuments.id, documentId), eq(kycDocuments.verificationId, verificationId)));
    if (!doc || doc.purgedAt) throw AppException.notFound('Document');
    await this.db.insert(kycEvents).values({ verificationId, actorId, event: 'document_viewed', note: `${doc.type}:${doc.side}` });
    await this.audit.record({ action: 'kyc.document.view', entityType: 'kyc_document', entityId: doc.id, actorId });
    return {
      url: await this.storage.signedUrl(doc.storageKey, 120, `${doc.type}-${doc.side}.${doc.mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`),
      expiresIn: 120,
      mimeType: doc.mimeType,
      number: doc.documentNumberEnc ? this.crypto.decrypt(doc.documentNumberEnc) : null,
    };
  }

  async startReview(id: string, actorId: string) {
    return this.transition(id, actorId, ['pending'], 'under_review', 'review_started', {}, async () => undefined);
  }

  async approve(id: string, actorId: string, note?: string) {
    const days = await this.settings.number('kyc.approvedRetentionDays', 1825);
    return this.transition(id, actorId, OPEN, 'approved', 'approved', { reviewNote: note ?? null, retentionUntil: sql`now() + make_interval(days => ${days})` }, async (v, tx) => {
      await this.rbac.grantRoleSystem(v.userId, v.requestedRole as Role, tx);
      for (const listener of this.approvalListeners) await listener(v, tx);
      await this.notifications.notify(
        v.userId,
        { type: 'kyc', titleKey: 'api.kyc.approvedTitle', bodyKey: 'api.kyc.approvedBody', params: { role: await this.roleLabel(v.userId, v.requestedRole as Role, tx) }, link: '/account/verification' },
        tx,
      );
    });
  }

  async reject(id: string, actorId: string, reason: string) {
    const days = await this.settings.number('kyc.rejectedRetentionDays', 90);
    return this.transition(id, actorId, OPEN, 'rejected', 'rejected', { rejectionReason: reason, retentionUntil: sql`now() + make_interval(days => ${days})` }, async (v, tx) => {
      await this.notifications.notify(v.userId, { type: 'kyc', titleKey: 'api.kyc.rejectedTitle', bodyKey: 'api.kyc.rejectedBody', params: { reason }, link: '/account/verification' }, tx);
    });
  }

  async requestResubmission(id: string, actorId: string, reason: string) {
    const days = await this.settings.number('kyc.rejectedRetentionDays', 90);
    return this.transition(id, actorId, OPEN, 'resubmission_required', 'resubmission_requested', { rejectionReason: reason, retentionUntil: sql`now() + make_interval(days => ${days})` }, async (v, tx) => {
      await this.notifications.notify(v.userId, { type: 'kyc', titleKey: 'api.kyc.resubmissionTitle', bodyKey: 'api.kyc.resubmissionBody', params: { reason }, link: '/account/verification' }, tx);
    });
  }

  /** Daily: delete documents whose retention period has ended (files, encrypted numbers). */
  @Cron('15 3 * * *', { name: 'kyc-retention', timeZone: 'Asia/Dhaka' })
  async purgeExpiredDocuments(): Promise<number> {
    const due = await this.db
      .select({ id: kycDocuments.id, key: kycDocuments.storageKey, verificationId: kycDocuments.verificationId })
      .from(kycDocuments)
      .innerJoin(kycVerifications, eq(kycVerifications.id, kycDocuments.verificationId))
      .where(and(isNull(kycDocuments.purgedAt), lt(kycVerifications.retentionUntil, sql`now()`)))
      .limit(500);
    for (const doc of due) await this.storage.delete('private', doc.key);
    const verificationIds = [...new Set(due.map((d) => d.verificationId))];
    if (due.length) {
      await this.db.transaction(async (tx) => {
        await tx.update(kycDocuments).set({ purgedAt: new Date(), documentNumberEnc: null }).where(inArray(kycDocuments.id, due.map((d) => d.id)));
        await tx.insert(kycEvents).values(verificationIds.map((verificationId) => ({ verificationId, actorId: null, event: 'documents_purged' })));
      });
      this.logger.log(`Purged ${due.length} identity documents past their retention period`);
    }
    return due.length;
  }

  // ----------------------------------------------------------------- internals

  private async transition(
    id: string,
    actorId: string,
    from: KycStatus[],
    to: KycStatus,
    event: string,
    changes: Partial<Record<keyof Verification, unknown>>,
    after: (verification: Verification, tx: DbOrTx) => Promise<void>,
  ) {
    const current = await this.get(id);
    if (current.userId === actorId) throw new AppException('FORBIDDEN', 'api.kyc.selfReview');
    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(kycVerifications)
        .set({
          ...(changes as object),
          status: to,
          reviewerId: actorId,
          ...(to === 'under_review' ? { reviewStartedAt: new Date() } : { decidedAt: new Date() }),
        })
        .where(and(eq(kycVerifications.id, id), inArray(kycVerifications.status, from)))
        .returning();
      if (!updated) throw new AppException('CONFLICT', 'api.kyc.invalidTransition');
      await tx.insert(kycEvents).values({ verificationId: id, actorId, event, fromStatus: current.status, toStatus: to, note: (changes.rejectionReason as string | undefined) ?? (changes.reviewNote as string | undefined) ?? null });
      await this.audit.record({ action: `kyc.${event}`, entityType: 'kyc_verification', entityId: id, before: { status: current.status }, after: { status: to }, actorId }, tx);
      await after(updated, tx);
    });
    return this.detail(id);
  }

  private async get(id: string): Promise<Verification> {
    const [verification] = await this.db.select().from(kycVerifications).where(eq(kycVerifications.id, id));
    if (!verification) throw AppException.notFound('Verification');
    return verification;
  }

  private documentsOf(tx: DbOrTx, ids: string[]) {
    if (!ids.length) return Promise.resolve([] as Array<typeof kycDocuments.$inferSelect>);
    return tx.select().from(kycDocuments).where(inArray(kycDocuments.verificationId, ids)).orderBy(asc(kycDocuments.createdAt));
  }

  private presentForOwner(v: Verification, docs: Array<typeof kycDocuments.$inferSelect>, events: Array<typeof kycEvents.$inferSelect>) {
    return {
      id: v.id,
      purpose: v.purpose,
      requestedRole: v.requestedRole,
      status: v.status,
      legalName: v.legalName,
      businessName: v.businessName,
      institutionName: v.institutionName,
      rejectionReason: v.rejectionReason,
      submittedAt: v.submittedAt.toISOString(),
      decidedAt: v.decidedAt?.toISOString() ?? null,
      documents: docs
        .filter((d) => d.verificationId === v.id)
        .map((d) => ({ id: d.id, type: d.type, side: d.side, numberLast4: d.documentNumberLast4, mimeType: d.mimeType, sizeBytes: d.sizeBytes, purged: !!d.purgedAt })),
      // Owners see the timeline but not who looked at their documents.
      timeline: events
        .filter((e) => e.verificationId === v.id && e.event !== 'document_viewed')
        .map((e) => ({ event: e.event, status: e.toStatus, at: e.createdAt.toISOString() })),
    };
  }

  private async roleLabel(userId: string, role: Role, tx: DbOrTx): Promise<string> {
    const [user] = await tx.select({ locale: users.locale }).from(users).where(eq(users.id, userId));
    return translate(user?.locale === 'en' ? 'en' : 'bn', `roles.${role}`);
  }
}
