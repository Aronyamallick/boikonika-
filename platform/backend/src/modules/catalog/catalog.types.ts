/** Book as shown in shelves, search results and listings. */
export interface BookCard {
  id: string;
  slug: string;
  title: string;
  language: string;
  coverUrl: string | null;
  authors: Array<{ name: string; slug: string }>;
  minPrice: string | null;
  compareAtPrice: string | null;
  offerCount: number;
  inStock: boolean;
  hasUsed: boolean;
  isFree: boolean;
  ratingAvg: number;
  ratingCount: number;
}

export interface ProductCard {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  price: string;
  compareAtPrice: string | null;
  inStock: boolean;
  ratingAvg: number;
  ratingCount: number;
  store: { name: string; slug: string } | null;
}

export interface Page<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number };
}
