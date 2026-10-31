import { sql } from 'drizzle-orm';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { approvedSeller, categoryId, createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });
const key = () => `chk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

/** A real PDF of `pages` pages, each saying which page it is. */
async function makePdf(pages: number, label = 'Sample book'): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) pdf.addPage([420, 595]).drawText(`${label} - page ${i}`, { x: 50, y: 520, size: 16, font });
  return Buffer.from(await pdf.save());
}
const pageCount = async (body: Buffer) => (await PDFDocument.load(body)).getPageCount();
/** Follows a local signed link (…/api/v1/files/<token>) through the test server. */
const fetchSigned = (ctx: TestContext, url: string) =>
  ctx.http
    .get(new URL(url).pathname)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });

describe('Digital library (e2e)', () => {
  let ctx: TestContext;
  let admin: RegisteredUser;
  let publisher: RegisteredUser;
  let bookId: string;
  let slug: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    admin = await registerUser(ctx, { name: 'Admin' });
    await grantRole(ctx, admin.id, 'super_admin');
    publisher = await approvedSeller(ctx, admin, 'publisher', 'আলো প্রকাশনী');
    const [own] = (await ctx.db.execute<{ id: string }>(sql`select id from publishers where owner_id = ${publisher.id}`)).rows;
    const listed = await ctx.http
      .post(`${API}/seller/books`)
      .set(as(publisher))
      .send({
        book: { title: 'নদীর গল্প', language: 'bn', categoryId: await categoryId(ctx, 'books/poetry'), authorNames: ['নতুন লেখক'], publisherId: own!.id },
        format: { format: 'paperback', pages: 96 },
        price: '220',
        stock: 10,
        declaration: { capacity: 'publisher', accepted: true },
      })
      .expect(201);
    const [book] = (await ctx.db.execute<{ id: string; slug: string }>(sql`select b.id, b.slug from products p join books b on b.id = p.book_id where p.id = ${listed.body.data.id}`)).rows;
    bookId = book!.id;
    slug = book!.slug;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const upload = (user: RegisteredUser, file: Buffer, capacity = 'publisher', name = 'book.pdf') =>
    ctx.http.post(`${API}/studio/digital/${bookId}/file`).set(as(user)).field('data', JSON.stringify({ capacity, accepted: true })).attach('file', file, { filename: name });

  async function address(user: RegisteredUser) {
    const res = await ctx.http
      .post(`${API}/me/addresses`)
      .set(as(user))
      .send({ recipientName: 'Nadia Rahman', phone: '01712345678', division: 'dhaka', district: 'dhaka', upazila: 'Dhanmondi', area: 'Road 27', addressLine: 'House 5, Flat 3B' })
      .expect(201);
    return res.body.data.id as string;
  }

  it('lets only the rights holder upload, with checks on the file and an automatic sample', async () => {
    const pdf = await makePdf(20);
    const stranger = await registerUser(ctx);
    await upload(stranger, pdf).expect(403);
    // The publisher isn't linked to the book as its author.
    expect((await upload(publisher, pdf, 'author').expect(400)).body.errors[0].field).toBe('capacity');
    await ctx.http.post(`${API}/studio/digital/${bookId}/file`).set(as(publisher)).field('data', JSON.stringify({ capacity: 'publisher' })).attach('file', pdf, { filename: 'a.pdf' }).expect(400);
    await upload(publisher, Buffer.from('<html><body>not a book</body></html>'), 'publisher', 'book.pdf').expect(415);

    const res = await upload(publisher, pdf).expect(201);
    expect(res.body.data.asset).toMatchObject({ format: 'pdf', pageCount: 20, status: 'active', fileName: 'নদীর গল্প.pdf' });
    expect(res.body.data.offer).toBeNull();
    // The sample is the first 10% of the book, built from the file itself.
    expect(res.body.data.previews).toEqual([expect.objectContaining({ kind: 'pdf', previewPercent: 10, samplePages: 2 })]);
    const preview = await ctx.http.get(`${API}/books/${slug}/preview`).expect(200);
    const sample = await fetchSigned(ctx, preview.body.data.previews[0].pdfUrl).expect(200);
    expect(sample.headers['content-type']).toBe('application/pdf');
    expect(await pageCount(sample.body as Buffer)).toBe(2);

    const declared = await ctx.db.execute(sql`select capacity from ownership_declarations where subject_type = 'digital_asset' and user_id = ${publisher.id}`);
    expect(declared.rows).toEqual([{ capacity: 'publisher' }]);

    // Sample length is the rights holder's choice, within the site limit.
    await ctx.http.put(`${API}/studio/digital/${bookId}/preview-length`).set(as(publisher)).send({ previewPercent: 30 }).expect(400);
    const longer = await ctx.http.put(`${API}/studio/digital/${bookId}/preview-length`).set(as(publisher)).send({ previewPercent: 20 }).expect(200);
    expect(longer.body.data.previews[0]).toMatchObject({ previewPercent: 20, samplePages: 4 });
    const chapter = { title: 'প্রথম অধ্যায়: নদীর ধারে', content: 'নদীর ধারে ছোট একটা গ্রাম। '.repeat(20) };
    await ctx.http.post(`${API}/studio/digital/${bookId}/chapters`).set(as(stranger)).send(chapter).expect(403);
    await ctx.http.post(`${API}/studio/digital/${bookId}/chapters`).set(as(publisher)).send(chapter).expect(201);
    const look = await ctx.http.get(`${API}/books/${slug}/preview`).expect(200);
    expect(look.body.data.previews.map((p: { kind: string }) => p.kind)).toEqual(['pdf', 'sample_chapter']);
    expect(look.body.data.previews[1].content).toContain('নদীর ধারে');

    // The same file can't be published for another book.
    const other = await ctx.http
      .post(`${API}/seller/books`)
      .set(as(publisher))
      .send({ book: { title: 'অন্য বই', language: 'bn', categoryId: await categoryId(ctx, 'books/poetry'), authorNames: ['নতুন লেখক'] }, format: { format: 'paperback' }, price: '100', stock: 1, declaration: { capacity: 'publisher', accepted: true } })
      .expect(201);
    const [otherBook] = (await ctx.db.execute<{ book_id: string }>(sql`select book_id from products where id = ${other.body.data.id}`)).rows;
    await ctx.db.execute(sql`insert into book_publishers (book_id, publisher_id) select ${otherBook!.book_id}, id from publishers where owner_id = ${publisher.id}`);
    await ctx.http.post(`${API}/studio/digital/${otherBook!.book_id}/file`).set(as(publisher)).field('data', JSON.stringify({ capacity: 'publisher', accepted: true })).attach('file', pdf, { filename: 'b.pdf' }).expect(409);
  });

  it('sells the e-book: no shipping, no cash on delivery, instant delivery and logged downloads', async () => {
    const pdf = await makePdf(12);
    await upload(publisher, pdf).expect(201);
    await ctx.http.put(`${API}/studio/digital/${bookId}/offer`).set(as(publisher)).send({ free: false, price: '5' }).expect(400);
    const offered = await ctx.http.put(`${API}/studio/digital/${bookId}/offer`).set(as(publisher)).send({ free: false, price: '150' }).expect(200);
    expect(offered.body.data.offer).toMatchObject({ mode: 'paid', price: '150.00' });

    const detail = await ctx.http.get(`${API}/books/${slug}`).expect(200);
    expect(detail.body.data.digital).toMatchObject({ format: 'pdf', pageCount: 12, free: false });
    const ebook = detail.body.data.offers.find((o: { isDigital: boolean }) => o.isDigital);
    expect(ebook).toMatchObject({ price: '150.00' });

    const buyer = await registerUser(ctx, { name: 'Reader' });
    await ctx.http.post(`${API}/me/library/${bookId}/download`).set(as(buyer)).expect(403);
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: ebook.variantId, quantity: 3 }).expect(200);
    const cart = await ctx.http.get(`${API}/cart`).set(as(buyer)).expect(200);
    expect(cart.body.data.groups[0].items[0]).toMatchObject({ quantity: 1, isDigital: true });
    await ctx.http.patch(`${API}/cart/items/${ebook.variantId}`).set(as(buyer)).send({ quantity: 2 }).expect(400);

    const addressId = await address(buyer);
    const quote = await ctx.http.post(`${API}/checkout/quote`).set(as(buyer)).send({ addressId }).expect(200);
    expect(quote.body.data.totals).toMatchObject({ shippingTotal: '0.00', grandTotal: '150.00', digitalOnly: true });
    expect(quote.body.data.paymentMethods.find((m: { method: string }) => m.method === 'cod')).toMatchObject({ available: false });
    await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'cod', idempotencyKey: key() }).expect(400);

    const placed = await ctx.http.post(`${API}/checkout`).set(as(buyer)).send({ addressId, paymentMethod: 'sandbox', idempotencyKey: key() }).expect(201);
    // Not paid yet: nothing to download.
    await ctx.http.post(`${API}/me/library/${bookId}/download`).set(as(buyer)).expect(403);
    await ctx.http.post(`${API}/payments/sandbox/${placed.body.data.payment.id}/complete`).set(as(buyer)).send({ outcome: 'success' }).expect(200);

    const order = await ctx.http.get(`${API}/orders/${placed.body.data.order.number}`).set(as(buyer)).expect(200);
    expect(order.body.data).toMatchObject({ status: 'delivered', paymentStatus: 'paid' });
    expect(order.body.data.sellerOrders[0]).toMatchObject({ status: 'delivered', shippingFee: '0.00' });
    const shelf = await ctx.http.get(`${API}/me/library/${bookId}`).set(as(buyer)).expect(200);
    expect(shelf.body.data).toMatchObject({ shelf: 'purchased', hasDigitalAccess: true });
    const library = await ctx.http.get(`${API}/me/library?digital=1`).set(as(buyer)).expect(200);
    expect(library.body.data).toMatchObject({ total: 1, digitalCount: 1 });

    const link = await ctx.http.post(`${API}/me/library/${bookId}/download`).set(as(buyer)).expect(200);
    expect(link.body.data).toMatchObject({ format: 'pdf', fileName: 'নদীর গল্প.pdf' });
    const file = await fetchSigned(ctx, link.body.data.url).expect(200);
    // The exact Bangla name, plus a plain fallback (the slug is Bangla too, so a generic one).
    expect(file.headers['content-disposition']).toBe(`attachment; filename="ebook.pdf"; filename*=UTF-8''${encodeURIComponent('নদীর গল্প.pdf')}`);
    expect(Buffer.compare(file.body as Buffer, pdf)).toBe(0);
    // A tampered link is refused.
    await ctx.http.get(`${new URL(link.body.data.url).pathname}x`).expect(404);
    const history = await ctx.http.get(`${API}/me/downloads`).set(as(buyer)).expect(200);
    expect(history.body.data[0]).toMatchObject({ format: 'pdf', book: { slug } });
    expect((await ctx.db.execute(sql`select 1 from downloads where user_id = ${buyer.id}`)).rows).toHaveLength(1);

    // Owned already: no second purchase, and e-books can't be returned.
    await ctx.http.post(`${API}/cart/items`).set(as(buyer)).send({ variantId: ebook.variantId }).expect(409);
    const [item] = order.body.data.sellerOrders[0].items;
    await ctx.http.post(`${API}/orders/${placed.body.data.order.number}/returns`).set(as(buyer)).send({ sellerOrderId: order.body.data.sellerOrders[0].id, reason: 'damaged', items: [{ orderItemId: item.id, quantity: 1 }] }).expect(400);

    // Daily download cap.
    await ctx.db.execute(sql`insert into system_settings (key, value) values ('digital.downloadsPerDay', '2'::jsonb) on conflict (key) do update set value = excluded.value`);
    await ctx.redis.del('setting:digital.downloadsPerDay');
    await ctx.http.post(`${API}/me/library/${bookId}/download`).set(as(buyer)).expect(200);
    await ctx.http.post(`${API}/me/library/${bookId}/download`).set(as(buyer)).expect(429);
  });

  it('withdraws, gives away free, and handles copyright takedowns', async () => {
    const pdf = await makePdf(8);
    await upload(publisher, pdf).expect(201);
    await ctx.http.put(`${API}/studio/digital/${bookId}/offer`).set(as(publisher)).send({ free: true }).expect(200);
    const reader = await registerUser(ctx);
    expect((await ctx.http.get(`${API}/books/${slug}`).expect(200)).body.data).toMatchObject({ isFree: true, digital: { free: true } });
    await ctx.http.post(`${API}/me/library/${bookId}/free`).set(as(reader)).expect(200);
    await ctx.http.post(`${API}/me/library/${bookId}/download`).set(as(reader)).expect(200);

    // Withdrawn: newcomers can't get it, readers who have it keep it.
    await ctx.http.delete(`${API}/studio/digital/${bookId}/offer`).set(as(publisher)).expect(200);
    const late = await registerUser(ctx);
    await ctx.http.post(`${API}/me/library/${bookId}/free`).set(as(late)).expect(400);
    await ctx.http.post(`${API}/me/library/${bookId}/download`).set(as(late)).expect(403);
    await ctx.http.post(`${API}/me/library/${bookId}/download`).set(as(reader)).expect(200);
    expect((await ctx.http.get(`${API}/books/${slug}/preview`).expect(200)).body.data.previews).toEqual([]);

    // Copyright takedown: nobody downloads it, the file can't be re-uploaded, and staff can restore it.
    const files = await ctx.http.get(`${API}/admin/digital`).set(as(admin)).expect(200);
    expect(files.body.data[0]).toMatchObject({ status: 'withdrawn', declaration: { capacity: 'publisher' } });
    await ctx.http.get(`${API}/admin/digital`).set(as(reader)).expect(403);
    await ctx.http.post(`${API}/admin/digital/${files.body.data[0].id}/takedown`).set(as(admin)).send({ reason: 'Upheld complaint from the original publisher.' }).expect(200);
    await ctx.http.post(`${API}/me/library/${bookId}/download`).set(as(reader)).expect(404);
    await upload(publisher, pdf).expect(409);
    await upload(publisher, await makePdf(9, 'Another')).expect(409);
    expect((await ctx.db.execute(sql`select 1 from notifications where user_id = ${publisher.id} and type = 'listing'`)).rows.length).toBeGreaterThan(0);
    await ctx.http.post(`${API}/admin/digital/${files.body.data[0].id}/restore`).set(as(admin)).expect(200);
    await ctx.http.post(`${API}/me/library/${bookId}/download`).set(as(reader)).expect(200);
  });
});
