import type { Database } from '../client';
import { cmsPages, faqs, homepageSections, quizQuestions, quizzes } from '../schema';
import { FAQS } from './data/faqs';
import { PAGES } from './data/pages';
import { QUIZZES } from './data/quizzes';
import { SECTIONS } from './data/sections';

/** CMS pages and homepage sections are inserted once; later admin edits are never overwritten. */
export async function seedContent(db: Database): Promise<void> {
  await db
    .insert(cmsPages)
    .values(PAGES.map((p) => ({ slug: p.slug, title: p.title, body: p.body, status: 'published' as const })))
    .onConflictDoNothing({ target: cmsPages.slug });
  await db
    .insert(homepageSections)
    .values(SECTIONS.map((s, position) => ({ key: s.key, type: s.type, title: s.title, subtitle: s.subtitle ?? null, config: s.config ?? {}, position, isEnabled: s.enabled ?? true })))
    .onConflictDoNothing({ target: homepageSections.key });
  // FAQs have no natural key, so they are only seeded into an empty table.
  if ((await db.$count(faqs)) === 0) await db.insert(faqs).values(FAQS.map((f, position) => ({ category: f.category, question: f.question, answer: f.answer, position })));
}

/** Starter Student Zone quizzes (added once; editors may change or hide them afterwards). */
export async function seedQuizzes(db: Database): Promise<void> {
  for (const quiz of QUIZZES) {
    const { questions, ...fields } = quiz;
    const [row] = await db.insert(quizzes).values({ ...fields, status: 'published' }).onConflictDoNothing({ target: quizzes.slug }).returning({ id: quizzes.id });
    if (!row) continue;
    await db.insert(quizQuestions).values(questions.map((q, i) => ({ quizId: row.id, ...q, position: i })));
  }
}
