import { sql } from 'drizzle-orm';
import { createTestApp, grantRole, registerUser, resetState, type RegisteredUser, type TestContext } from './utils';

const API = '/api/v1';
const as = (u: RegisteredUser) => ({ Authorization: `Bearer ${u.accessToken}` });
const SLUG = 'general-knowledge-bangladesh';
// Correct answers of the starter Bangladesh quiz, in order.
const KEY = [1, 1, 0, 1, 1, 1, 1];

describe('Student Zone (e2e)', () => {
  let ctx: TestContext;
  let student: RegisteredUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetState(ctx);
    student = await registerUser(ctx, { name: 'Student' });
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const stats = async (u: RegisteredUser) => (await ctx.db.execute<{ xp_total: number; quizzes_passed: number }>(sql`select xp_total, quizzes_passed from user_stats where user_id = ${u.id}`)).rows[0];

  it('serves quizzes without answers and grades attempts on the server', async () => {
    const list = await ctx.http.get(`${API}/quizzes?subject=general_knowledge`).expect(200);
    expect(list.body.data.map((q: { slug: string }) => q.slug)).toEqual([SLUG]);
    const quiz = await ctx.http.get(`${API}/quizzes/${SLUG}`).expect(200);
    expect(quiz.body.data.questions).toHaveLength(7);
    // The answer key never reaches the client before submission.
    expect(JSON.stringify(quiz.body.data)).not.toMatch(/correctIndex|explanation/);

    const startedAt = new Date(Date.now() - 60_000).toISOString();
    await ctx.http.post(`${API}/quizzes/${SLUG}/attempts`).set(as(student)).send({ answers: [1, 1], startedAt }).expect(400);
    const failed = await ctx.http.post(`${API}/quizzes/${SLUG}/attempts`).set(as(student)).send({ answers: [0, 0, 0, 1, -1, 1, 0], startedAt }).expect(201);
    expect(failed.body.data).toMatchObject({ correctCount: 3, total: 7, scorePercent: 43, passed: false });
    expect(failed.body.data.results[0]).toMatchObject({ chosen: 0, correctIndex: 1, correct: false });
    expect(failed.body.data.results[0].explanation).toMatch(/Dhaka/);
    expect(await stats(student)).toBeUndefined();

    const passed = await ctx.http.post(`${API}/quizzes/${SLUG}/attempts`).set(as(student)).send({ answers: KEY, startedAt }).expect(201);
    expect(passed.body.data).toMatchObject({ scorePercent: 100, passed: true, firstPass: true });
    expect(await stats(student)).toMatchObject({ quizzes_passed: 1, xp_total: 15 });
    // Passing again earns nothing more.
    await ctx.http.post(`${API}/quizzes/${SLUG}/attempts`).set(as(student)).send({ answers: KEY, startedAt }).expect(201);
    expect(await stats(student)).toMatchObject({ quizzes_passed: 1, xp_total: 15 });

    // Finishing far past the time limit shows the answers but is not a pass.
    const late = await ctx.http.post(`${API}/quizzes/english-grammar-tenses/attempts`).set(as(student)).send({ answers: [1, 1, 2, 1, 2], startedAt: new Date(Date.now() - 20 * 60_000).toISOString() }).expect(201);
    expect(late.body.data).toMatchObject({ scorePercent: 100, late: true, passed: false });
    await ctx.http.post(`${API}/quizzes/english-grammar-tenses/attempts`).set(as(student)).send({ answers: [1, 1, 2, 1, 2], startedAt: new Date(Date.now() - 7 * 3_600_000).toISOString() }).expect(400);

    const mine = await ctx.http.get(`${API}/quizzes/${SLUG}`).set(as(student)).expect(200);
    expect(mine.body.data).toMatchObject({ best: 100, passed: true });
    expect(mine.body.data.myAttempts).toHaveLength(3);
  });

  it('lets teachers publish quizzes and keeps students out', async () => {
    const quiz = {
      title: 'রসায়ন: পর্যায় সারণি',
      subject: 'chemistry',
      academicLevel: 'ssc',
      questions: [
        { prompt: 'পর্যায় সারণির প্রথম মৌল কোনটি?', options: ['হিলিয়াম', 'হাইড্রোজেন', 'লিথিয়াম'], correctIndex: 1, explanation: 'হাইড্রোজেনের পারমাণবিক সংখ্যা ১।' },
        { prompt: 'সোডিয়ামের প্রতীক কী?', options: ['S', 'So', 'Na'], correctIndex: 2 },
      ],
    };
    await ctx.http.post(`${API}/quizzes`).set(as(student)).send(quiz).expect(403);
    const teacher = await registerUser(ctx, { name: 'Teacher' });
    await grantRole(ctx, teacher.id, 'teacher');
    const bad = await ctx.http.post(`${API}/quizzes`).set(as(teacher)).send({ ...quiz, questions: [{ prompt: 'Duplicate?', options: ['A', 'a'], correctIndex: 0 }] }).expect(400);
    expect(bad.body.errors[0].field).toBe('questions.0.options');
    await ctx.http.post(`${API}/quizzes`).set(as(teacher)).send({ ...quiz, questions: [{ prompt: 'Out of range', options: ['A', 'B'], correctIndex: 2 }] }).expect(400);
    const created = await ctx.http.post(`${API}/quizzes`).set(as(teacher)).send(quiz).expect(201);
    expect((await ctx.http.get(`${API}/quizzes?subject=chemistry`).expect(200)).body.data[0]).toMatchObject({ slug: created.body.data.slug, questionCount: 2 });
    await ctx.http.put(`${API}/quizzes/${created.body.data.slug}/status`).set(as(student)).send({ status: 'hidden' }).expect(403);
    await ctx.http.put(`${API}/quizzes/${created.body.data.slug}/status`).set(as(teacher)).send({ status: 'hidden' }).expect(200);
    await ctx.http.get(`${API}/quizzes/${created.body.data.slug}`).expect(404);
  });

  it('keeps private study notes and shares the ones marked public', async () => {
    const note = await ctx.http.post(`${API}/me/notes`).set(as(student)).send({ title: 'নিউটনের গতিসূত্র', body: '১. জড়তা\n২. F = ma\n৩. ক্রিয়া-প্রতিক্রিয়া', subject: 'physics' }).expect(201);
    expect(note.body.data).toMatchObject({ visibility: 'private', subject: 'physics' });
    const other = await registerUser(ctx);
    await ctx.http.get(`${API}/notes/${note.body.data.id}`).set(as(other)).expect(404);
    await ctx.http.patch(`${API}/me/notes/${note.body.data.id}`).set(as(other)).send({ visibility: 'public' }).expect(404);
    await ctx.http.patch(`${API}/me/notes/${note.body.data.id}`).set(as(student)).send({ visibility: 'public' }).expect(200);
    expect((await ctx.http.get(`${API}/notes/${note.body.data.id}`).expect(200)).body.data).toMatchObject({ title: 'নিউটনের গতিসূত্র', author: { name: 'Student' } });
    expect((await ctx.http.get(`${API}/me/notes?subject=physics`).set(as(student)).expect(200)).body.data).toHaveLength(1);
    await ctx.http.delete(`${API}/me/notes/${note.body.data.id}`).set(as(student)).expect(200);
  });

  it('runs competitions, events and scholarships managed by staff', async () => {
    const staff = await registerUser(ctx, { name: 'Editor' });
    await grantRole(ctx, staff.id, 'admin');
    await ctx.http.post(`${API}/admin/student/events`).set(as(student)).send({ title: 'Book fair', startsAt: new Date(Date.now() + 86_400_000).toISOString() }).expect(403);
    await ctx.http
      .post(`${API}/admin/student/events`)
      .set(as(staff))
      .send({ title: 'বইমেলায় শিক্ষার্থীদের দিন', startsAt: new Date(Date.now() + 86_400_000).toISOString(), location: 'Bangla Academy, Dhaka', audience: 'student' })
      .expect(201);
    await ctx.http
      .post(`${API}/admin/student/scholarships`)
      .set(as(staff))
      .send({ title: 'Merit scholarship', provider: 'Example Foundation', description: 'For HSC students with strong results.', academicLevel: 'hsc', deadline: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10), applyUrl: 'https://example.org/apply' })
      .expect(201);
    const competition = await ctx.http
      .post(`${API}/admin/student/competitions`)
      .set(as(staff))
      .send({ title: 'Short story contest', kind: 'writing', rules: 'Up to 1500 words, original work only.', startsAt: new Date(Date.now() - 3_600_000).toISOString(), endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString() })
      .expect(201);
    const slug = competition.body.data.slug;
    await ctx.http.get(`${API}/competitions/${slug}`).expect(404);
    await ctx.http.put(`${API}/admin/student/competitions/${slug}/status`).set(as(staff)).send({ status: 'open' }).expect(200);

    const post = await ctx.http.post(`${API}/posts`).set(as(student)).field('data', JSON.stringify({ type: 'story', title: 'বৃষ্টির দিন', body: 'সেদিন সকাল থেকে আকাশ কালো হয়ে ছিল…' })).expect(201);
    const someoneElse = await registerUser(ctx);
    await ctx.http.post(`${API}/competitions/${slug}/entries`).set(as(someoneElse)).send({ postId: post.body.data.id }).expect(400);
    await ctx.http.post(`${API}/competitions/${slug}/entries`).set(as(student)).send({ postId: post.body.data.id }).expect(201);
    await ctx.http.post(`${API}/competitions/${slug}/entries`).set(as(student)).send({ postId: post.body.data.id }).expect(409);
    const entries = await ctx.http.get(`${API}/admin/student/competitions/${slug}/entries`).set(as(staff)).expect(200);
    await ctx.http.put(`${API}/admin/student/entries/${entries.body.data[0].id}`).set(as(staff)).send({ status: 'winner', score: 92 }).expect(200);
    expect((await ctx.http.get(`${API}/competitions/${slug}`).expect(200)).body.data.results).toEqual([]);
    await ctx.http.put(`${API}/admin/student/competitions/${slug}/status`).set(as(staff)).send({ status: 'closed' }).expect(200);
    const results = await ctx.http.get(`${API}/competitions/${slug}`).set(as(student)).expect(200);
    expect(results.body.data.results[0]).toMatchObject({ status: 'winner', score: 92, title: 'বৃষ্টির দিন' });
    expect(results.body.data.myEntry).toMatchObject({ status: 'winner' });
    expect((await ctx.db.execute(sql`select 1 from notifications where user_id = ${student.id} and type = 'announcement'`)).rows).toHaveLength(1);

    const home = await ctx.http.get(`${API}/student-zone`).expect(200);
    expect(home.body.data.quizzes.length).toBeGreaterThanOrEqual(4);
    expect(home.body.data.events[0]).toMatchObject({ title: 'বইমেলায় শিক্ষার্থীদের দিন' });
    expect(home.body.data.scholarships[0]).toMatchObject({ provider: 'Example Foundation', academicLevel: 'hsc' });
    expect(home.body.data.competitions).toEqual([]);
  });
});
