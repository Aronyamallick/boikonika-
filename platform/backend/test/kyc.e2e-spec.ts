import { kycDocuments, kycEvents, kycVerifications, notifications } from '@boikonika/database';
import { eq } from 'drizzle-orm';
import { KycService } from '../src/modules/kyc/kyc.service';
import { MINIMAL_PDF, photoWithExif } from './images';
import { createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });

const sellerRequest = (overrides: Record<string, unknown> = {}) => ({
  purpose: 'seller',
  requestedRole: 'book_seller',
  legalName: 'রহিম উদ্দিন',
  businessName: 'রহিম বুক হাউস',
  documents: [
    { type: 'nid', side: 'front', number: '1990 1234 5678 9' },
    { type: 'nid', side: 'back' },
  ],
  declarations: { accurate: true, authorised: true },
  ...overrides,
});

describe('Identity verification (e2e)', () => {
  let ctx: TestContext;
  let applicant: RegisteredUser;
  let admin: RegisteredUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    applicant = await registerUser(ctx, { name: 'Applicant' });
    admin = await registerUser(ctx, { name: 'Admin' });
    await grantRole(ctx, admin.id, 'admin');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  async function submit(user: RegisteredUser, data: Record<string, unknown>, files: Buffer[]) {
    let req = ctx.http.post(`${API}/kyc/verifications`).set(as(user)).field('data', JSON.stringify(data));
    for (const [i, file] of files.entries()) req = req.attach('documents', file, { filename: `doc-${i}.${file[0] === 0x25 ? 'pdf' : 'jpg'}` });
    return req;
  }

  it('accepts a complete request and keeps documents private and encrypted', async () => {
    const res = await submit(applicant, sellerRequest(), [await photoWithExif(), MINIMAL_PDF]);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'pending', purpose: 'seller', requestedRole: 'book_seller', documents: [{ type: 'nid', side: 'front', numberLast4: '6789' }, { type: 'nid', side: 'back' }] });
    expect(JSON.stringify(res.body)).not.toMatch(/https?:\/\//);
    const [doc] = await ctx.db.select().from(kycDocuments).where(eq(kycDocuments.verificationId, res.body.data.id));
    expect(doc!.storageKey).toMatch(/^kyc\//);
    expect(doc!.documentNumberEnc).toMatch(/^v1\./);
    expect(doc!.documentNumberEnc).not.toContain('1990');
    // A second open request for the same purpose is refused.
    const again = await submit(applicant, sellerRequest(), [await photoWithExif(), MINIMAL_PDF]);
    expect(again.status).toBe(409);
  });

  it('validates documents, numbers and declarations', async () => {
    const photo = await photoWithExif();
    expect((await submit(applicant, sellerRequest({ documents: [{ type: 'nid', side: 'front', number: '12345' }] }), [photo])).status).toBe(400);
    const publisher = await submit(applicant, sellerRequest({ purpose: 'publisher', requestedRole: 'publisher', documents: [{ type: 'nid', side: 'front', number: '1990123456789' }] }), [photo]);
    expect(publisher.status).toBe(400);
    expect(publisher.body.errors[0].field).toBe('documents');
    expect((await submit(applicant, sellerRequest({ requestedRole: 'admin' }), [photo, MINIMAL_PDF])).status).toBe(400);
    expect((await submit(applicant, sellerRequest({ declarations: { accurate: true, authorised: false } }), [photo, MINIMAL_PDF])).status).toBe(400);
    expect((await submit(applicant, sellerRequest(), [photo])).status).toBe(400);
    const notImage = await submit(applicant, sellerRequest(), [Buffer.from('MZ'.padEnd(64, 'x')), MINIMAL_PDF]);
    expect(notImage.status).toBe(415);
  });

  it('runs the review workflow with permissions, logged document views and role grant', async () => {
    const created = await submit(applicant, sellerRequest(), [await photoWithExif(), MINIMAL_PDF]);
    const id = created.body.data.id as string;

    await ctx.http.get(`${API}/admin/kyc`).set(as(applicant)).expect(403);
    const queue = await ctx.http.get(`${API}/admin/kyc?status=pending`).set(as(admin)).expect(200);
    expect(queue.body.data).toHaveLength(1);
    expect(queue.body.meta).toMatchObject({ total: 1, page: 1 });

    await ctx.http.post(`${API}/admin/kyc/${id}/review`).set(as(admin)).expect(200);
    const detail = await ctx.http.get(`${API}/admin/kyc/${id}`).set(as(admin)).expect(200);
    expect(detail.body.data.status).toBe('under_review');

    const docId = detail.body.data.documents[0].id as string;
    const opened = await ctx.http.get(`${API}/admin/kyc/${id}/documents/${docId}`).set(as(admin)).expect(200);
    expect(opened.body.data.number).toBe('1990123456789');
    const fileUrl = new URL(opened.body.data.url);
    const file = await ctx.http.get(fileUrl.pathname).expect(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
    expect(file.headers['cache-control']).toBe('private, no-store');
    const tampered = fileUrl.pathname.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    await ctx.http.get(tampered).expect(404);
    const views = await ctx.db.select().from(kycEvents).where(eq(kycEvents.event, 'document_viewed'));
    expect(views).toHaveLength(1);
    expect(views[0]!.actorId).toBe(admin.id);

    // Moderators can look but not decide.
    const moderator = await registerUser(ctx, { name: 'Moderator' });
    await grantRole(ctx, moderator.id, 'moderator');
    await ctx.http.post(`${API}/admin/kyc/${id}/approve`).set(as(moderator)).send({}).expect(403);

    await ctx.http.post(`${API}/admin/kyc/${id}/approve`).set(as(admin)).send({ note: 'Documents match' }).expect(200);
    await ctx.http.post(`${API}/admin/kyc/${id}/reject`).set(as(admin)).send({ reason: 'Too late now' }).expect(409);
    const me = await ctx.http.get(`${API}/auth/me`).set(as(applicant)).expect(200);
    expect(me.body.data.roles).toContain('book_seller');
    const mine = await ctx.http.get(`${API}/kyc/verifications`).set(as(applicant)).expect(200);
    expect(mine.body.data[0].status).toBe('approved');
    expect(mine.body.data[0].timeline.map((e: { event: string }) => e.event)).toEqual(['submitted', 'review_started', 'approved']);
    const notes = await ctx.db.select().from(notifications).where(eq(notifications.userId, applicant.id));
    expect(notes.map((n) => n.type)).toContain('kyc');
  });

  it('never lets staff decide on their own request', async () => {
    const own = await submit(admin, sellerRequest(), [await photoWithExif(), MINIMAL_PDF]);
    const res = await ctx.http.post(`${API}/admin/kyc/${own.body.data.id}/approve`).set(as(admin)).send({}).expect(403);
    expect(res.body.message).toMatch(/নিজের|own/);
  });

  it('supports resubmission and purges documents after the retention period', async () => {
    const first = await submit(applicant, sellerRequest(), [await photoWithExif(), MINIMAL_PDF]);
    await ctx.http.post(`${API}/admin/kyc/${first.body.data.id}/request-resubmission`).set(as(admin)).send({ reason: 'The NID photo is blurry' }).expect(200);
    const second = await submit(applicant, sellerRequest(), [await photoWithExif(), MINIMAL_PDF]);
    expect(second.status).toBe(201);
    const [row] = await ctx.db.select().from(kycVerifications).where(eq(kycVerifications.id, second.body.data.id));
    expect(row!.previousVerificationId).toBe(first.body.data.id);

    await ctx.db.update(kycVerifications).set({ retentionUntil: new Date(Date.now() - 1000) }).where(eq(kycVerifications.id, first.body.data.id));
    const purged = await ctx.app.get(KycService).purgeExpiredDocuments();
    expect(purged).toBe(2);
    const docs = await ctx.db.select().from(kycDocuments).where(eq(kycDocuments.verificationId, first.body.data.id));
    expect(docs.every((d) => d.purgedAt && !d.documentNumberEnc)).toBe(true);
    const detail = await ctx.http.get(`${API}/admin/kyc/${first.body.data.id}`).set(as(admin)).expect(200);
    await ctx.http.get(`${API}/admin/kyc/${first.body.data.id}/documents/${detail.body.data.documents[0].id}`).set(as(admin)).expect(404);
  });
});
