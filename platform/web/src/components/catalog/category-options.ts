import type { CategoryNode } from '@/lib/catalog';
import { localized } from '@/lib/catalog';
import type { CategoryOption } from './catalog-filters';

/** Flattens the category tree into indented select options (parents before children). */
export function categoryOptions(tree: CategoryNode[], locale: string): CategoryOption[] {
  const out: CategoryOption[] = [];
  const walk = (nodes: CategoryNode[]) => {
    for (const n of nodes) {
      // The root ("Books" / "Other products") is the "All categories" choice.
      if (n.depth > 0) out.push({ path: n.path, label: localized(n.name, locale), depth: n.depth });
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}
