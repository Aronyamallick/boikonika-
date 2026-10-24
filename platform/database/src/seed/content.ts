import type { Database } from '../client';
import { cmsPages, faqs, homepageSections } from '../schema';
import { FAQS } from './data/faqs';
import { PAGES } from './data/pages';
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
