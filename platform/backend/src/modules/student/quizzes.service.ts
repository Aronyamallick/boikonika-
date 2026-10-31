import { Inject, Injectable } from '@nestjs/common';
import { type Database, quizAttempts, quizQuestions, quizzes } from '@boikonika/database';
import type { quizListQuerySchema, quizSchema } from '@boikonika/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { GamificationService } from '../gamification/gamification.service';
import { uniqueSlug } from '../marketplace/sellers.service';
import { RbacService } from '../rbac/rbac.service';

type Row = Record<string, unknown>;
const ATTEMPTS_PER_HOUR = 10;
/** Network and page-load slack on top of a quiz's time limit. */
const GRACE_SECONDS = 30;

/**
 * Quizzes for the Student Zone. Correct answers never leave the server before an attempt is
 * submitted; grading, timing and XP (once per quiz, on the first pass) happen here.
 */
@Injectable()
export class QuizzesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly gamification: GamificationService,
    private readonly rbac: RbacService,
  ) {}

  async list(q: z.output<typeof quizListQuerySchema>, viewerId?: string) {
    const where = [sql`z.status = 'published'`];
    if (q.subject) where.push(sql`z.subject = ${q.subject}`);
    if (q.level) where.push(sql`z.academic_level = ${q.level}`);
    if (q.q) where.push(sql`(z.title % ${q.q} or z.title ilike ${`%${q.q.replace(/[%_\\]/g, '')}%`})`);
    const condition = sql.join(where, sql` and `);
    const [rows, total] = await Promise.all([
      this.db.execute<Row>(sql`
        select z.id, z.slug, z.title, z.description, z.subject, z.academic_level, z.language, z.time_limit_seconds, z.pass_percent, z.attempt_count,
          (select count(*)::int from quiz_questions qq where qq.quiz_id = z.id) as question_count,
          ${viewerId ? sql`(select max(a.score_percent) from quiz_attempts a where a.quiz_id = z.id and a.user_id = ${viewerId})` : sql`null`} as best,
          ${viewerId ? sql`exists (select 1 from quiz_attempts a where a.quiz_id = z.id and a.user_id = ${viewerId} and a.passed)` : sql`false`} as passed
        from quizzes z where ${condition}
        order by z.attempt_count desc, z.created_at desc limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`),
      this.db.execute<{ n: number }>(sql`select count(*)::int as n from quizzes z where ${condition}`),
    ]);
    return { items: rows.rows.map((r) => this.card(r)), meta: { page: q.page, pageSize: q.pageSize, total: total.rows[0]?.n ?? 0 } };
  }

  card(r: Row) {
    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      description: (r.description as string | null) ?? null,
      subject: r.subject as string,
      academicLevel: r.academic_level as string,
      language: r.language as string,
      timeLimitSeconds: r.time_limit_seconds === null ? null : Number(r.time_limit_seconds),
      passPercent: Number(r.pass_percent),
      attemptCount: Number(r.attempt_count ?? 0),
      questionCount: Number(r.question_count ?? 0),
      best: r.best === null || r.best === undefined ? null : Number(r.best),
      passed: r.passed === true,
    };
  }

  /** The quiz to take: questions and options, without the answers. */
  async get(slug: string, viewerId?: string) {
    const [quiz] = await this.db.select().from(quizzes).where(and(eq(quizzes.slug, slug), eq(quizzes.status, 'published')));
    if (!quiz) throw AppException.notFound('Quiz');
    const [questions, history] = await Promise.all([
      this.db.select({ id: quizQuestions.id, prompt: quizQuestions.prompt, options: quizQuestions.options }).from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(asc(quizQuestions.position)),
      viewerId
        ? this.db
            .select({ score: quizAttempts.scorePercent, passed: quizAttempts.passed, completedAt: quizAttempts.completedAt })
            .from(quizAttempts)
            .where(and(eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.userId, viewerId)))
            .orderBy(sql`${quizAttempts.completedAt} desc`)
            .limit(5)
        : Promise.resolve([]),
    ]);
    return {
      ...this.card({ ...quiz, academic_level: quiz.academicLevel, time_limit_seconds: quiz.timeLimitSeconds, pass_percent: quiz.passPercent, attempt_count: quiz.attemptCount, question_count: questions.length, best: history.length ? Math.max(...history.map((h) => h.score)) : null, passed: history.some((h) => h.passed) } as Row),
      questions,
      myAttempts: history.map((h) => ({ score: h.score, passed: h.passed, completedAt: h.completedAt.toISOString() })),
    };
  }

  async attempt(userId: string, slug: string, input: { answers: number[]; startedAt: string }) {
    const result = await this.db.transaction(async (tx) => {
      const [quiz] = await tx.select().from(quizzes).where(and(eq(quizzes.slug, slug), eq(quizzes.status, 'published')));
      if (!quiz) throw AppException.notFound('Quiz');
      const questions = await tx.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(asc(quizQuestions.position));
      if (input.answers.length !== questions.length) throw AppException.validation([{ field: 'answers', code: 'length', message: 'validation.answerEveryQuestion' }]);
      const startedAt = new Date(input.startedAt);
      const now = Date.now();
      if (startedAt.getTime() > now + 60_000 || startedAt.getTime() < now - 6 * 3_600_000) throw AppException.badRequest('api.student.attemptExpired', 'startedAt');
      const [{ recent } = { recent: 0 }] = await tx
        .execute<{ recent: number }>(sql`select count(*)::int as recent from quiz_attempts where user_id = ${userId} and quiz_id = ${quiz.id} and completed_at > now() - interval '1 hour'`)
        .then((r) => r.rows);
      if (recent >= ATTEMPTS_PER_HOUR) throw new AppException('RATE_LIMITED', 'api.student.tooManyAttempts');
      const late = !!quiz.timeLimitSeconds && now - startedAt.getTime() > (quiz.timeLimitSeconds + GRACE_SECONDS) * 1000;
      const results = questions.map((q, i) => ({ questionId: q.id, chosen: input.answers[i]!, correctIndex: q.correctIndex, correct: input.answers[i] === q.correctIndex, explanation: q.explanation }));
      const correctCount = results.filter((r) => r.correct).length;
      const scorePercent = Math.round((correctCount / questions.length) * 100);
      // Finishing after the time limit still shows the answers, but doesn't count as a pass.
      const passed = !late && scorePercent >= quiz.passPercent;
      const [{ passedBefore } = { passedBefore: false }] = await tx
        .execute<{ passedBefore: boolean }>(sql`select exists (select 1 from quiz_attempts where user_id = ${userId} and quiz_id = ${quiz.id} and passed) as "passedBefore"`)
        .then((r) => r.rows);
      await tx.insert(quizAttempts).values({ quizId: quiz.id, userId, answers: input.answers, correctCount, totalCount: questions.length, scorePercent, passed, startedAt });
      await tx.update(quizzes).set({ attemptCount: sql`${quizzes.attemptCount} + 1` }).where(eq(quizzes.id, quiz.id));
      if (passed && !passedBefore) {
        await this.gamification.bump(tx, userId, { quizzesPassed: 1 });
        await this.gamification.award(tx, userId, 'quiz_passed', quiz.id);
      }
      return { scorePercent, correctCount, total: questions.length, passed, late, passPercent: quiz.passPercent, firstPass: passed && !passedBefore, results };
    });
    if (result.firstPass) await this.gamification.evaluateBadges(userId).catch(() => undefined);
    return result;
  }

  /** Teachers and Student Zone staff publish quizzes. */
  async create(userId: string, input: z.output<typeof quizSchema>) {
    const roles = await this.rbac.rolesOf(userId);
    if (!roles.includes('teacher') && !(await this.rbac.can(userId, ['student.manage']))) throw AppException.forbidden('api.student.teachersOnly');
    const slug = await this.db.transaction(async (tx) => {
      const slug = await uniqueSlug(tx, 'quizzes', input.title);
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          slug,
          title: input.title,
          description: input.description || null,
          subject: input.subject,
          academicLevel: input.academicLevel,
          language: input.language,
          bookId: input.bookId ?? null,
          timeLimitSeconds: input.timeLimitSeconds ?? null,
          passPercent: input.passPercent,
          createdBy: userId,
        })
        .returning({ id: quizzes.id });
      await tx.insert(quizQuestions).values(input.questions.map((q, i) => ({ quizId: quiz!.id, prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation || null, position: i })));
      return slug;
    });
    return { slug };
  }

  async mine(userId: string) {
    const rows = await this.db.execute<Row>(sql`
      select z.*, (select count(*)::int from quiz_questions qq where qq.quiz_id = z.id) as question_count, null as best, false as passed
      from quizzes z where z.created_by = ${userId} order by z.created_at desc limit 100`);
    return rows.rows.map((r) => ({ ...this.card(r), status: r.status as string }));
  }

  /** Staff hide or restore a quiz; authors can withdraw their own. */
  async setStatus(userId: string, slug: string, status: 'published' | 'hidden') {
    const [quiz] = await this.db.select({ id: quizzes.id, createdBy: quizzes.createdBy }).from(quizzes).where(eq(quizzes.slug, slug));
    if (!quiz) throw AppException.notFound('Quiz');
    const staff = await this.rbac.can(userId, ['student.manage']);
    if (!staff && (quiz.createdBy !== userId || status === 'published')) throw AppException.forbidden('api.student.teachersOnly');
    await this.db.update(quizzes).set({ status, updatedAt: new Date() }).where(eq(quizzes.id, quiz.id));
    return { status };
  }
}
