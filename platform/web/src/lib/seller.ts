/** Seller API shapes (mirrors the API). */
export interface SellerStore {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  division: string | null;
  district: string | null;
  address: string | null;
  returnPolicy: string | null;
  shippingPolicy: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  productCount: number;
  ratingAvg: number;
}

export interface SellerAccount {
  id: string;
  type: 'book_seller' | 'general_seller' | 'publisher' | 'author';
  status: string;
  commissionPercent: string;
  approvedAt: string | null;
  store: SellerStore | null;
}

export interface ListingRow {
  id: string;
  slug: string;
  type: 'book' | 'general';
  title: string;
  condition: string | null;
  status: string;
  price: string;
  compareAtPrice: string | null;
  totalStock: number;
  salesCount: number;
  viewCount: number;
  rejectionReason: string | null;
  updatedAt: string;
  imageUrl: string | null;
}

export interface ListingVariant {
  id: string;
  sku: string | null;
  name: string;
  options: Record<string, string>;
  price: string;
  compareAtPrice: string | null;
  isActive: boolean;
  onHand: number | null;
  reserved: number | null;
  lowStockThreshold: number | null;
}

export interface ListingDetail {
  id: string;
  slug: string;
  type: 'book' | 'general';
  bookId: string | null;
  title: string;
  description: string | null;
  condition: string | null;
  conditionNote: string | null;
  brand: string | null;
  categoryId: string | null;
  attributes: Record<string, string>;
  status: string;
  rejectionReason: string | null;
  price: string;
  compareAtPrice: string | null;
  totalStock: number;
  variants: ListingVariant[];
  images: Array<{ id: string; url: string; alt: string | null }>;
}

export interface IsbnMatch {
  bookId: string;
  formatId: string;
  slug: string;
  title: string;
  authors: string | null;
  format: string;
  edition: string | null;
  publicationYear: number | null;
  pages: number | null;
  coverUrl: string | null;
  alreadyListedConditions: string[];
}

export interface StockMovement {
  id: string;
  reason: string;
  onHandDelta: number;
  reservedDelta: number;
  note: string | null;
  createdAt: string;
}

export const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger' | 'info'> = {
  draft: 'neutral',
  pending_review: 'warning',
  active: 'success',
  rejected: 'danger',
  archived: 'neutral',
  suspended: 'danger',
};
