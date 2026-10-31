/** Catalogue constants shared by forms and API schemas (kept apart from zod so browser bundles stay small). */
export const CATALOG_SORTS = ['relevance', 'newest', 'popular', 'price_asc', 'price_desc', 'rating'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/** On what basis a seller may sell a book (declared on every book listing). */
export const OWNERSHIP_CAPACITIES = ['reseller_physical', 'author', 'publisher', 'licensed_distributor'] as const;

export const STOCK_ADJUST_REASONS = ['restock', 'adjustment', 'damaged', 'return'] as const;
