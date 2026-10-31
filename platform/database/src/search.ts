/**
 * Builds the denormalised `search_text` stored on books and products so a single generated
 * tsvector (plus trigram indexes) covers titles, authors in both scripts, publishers, ISBNs and
 * tags. Kept in one place so the API and the seed produce the same text.
 */
export function buildSearchText(parts: Array<string | null | undefined | Array<string | null | undefined>>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts.flat()) {
    const value = part?.replace(/\s+/g, ' ').trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
  }
  return out.join(' ').slice(0, 4000);
}
