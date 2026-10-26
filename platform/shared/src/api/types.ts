/**
 * Shapes of the API's responses, shared by the website and the mobile app so both read the same API
 * the same way. Money is a decimal string; dates are ISO strings.
 */
import type { ArticleKind } from '../constants/cms';
import type { LibraryShelf, NotificationChannel, NotificationType } from '../constants/statuses';

/** Catalogue response shapes (mirrors the API; the API is the source of truth). */
export interface BookCardData {
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

export interface ProductCardData {
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

export interface AuthorCardData {
  slug: string;
  name: string;
  nameAlt: string | null;
  photoUrl: string | null;
  verified: boolean;
  bookCount: number;
  followerCount: number;
}

export interface StoreCardData {
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  district: string | null;
  ratingAvg: number;
  productCount: number;
}

export type LocalizedText = { bn: string; en: string } | null;

export interface HomeSection {
  key: string;
  type: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  config: { source?: string; content?: Record<string, unknown> };
  items: unknown[];
}

export interface CategoryNode {
  id: string;
  slug: string;
  path: string;
  name: LocalizedText;
  icon: string | null;
  appliesTo: string;
  depth: number;
  children: CategoryNode[];
}

export interface CategoryDetail {
  slug: string;
  path: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string | null;
  appliesTo: string;
  children: Array<{ slug: string; path: string; name: LocalizedText; icon: string | null }>;
  breadcrumbs: Array<{ path: string; name: LocalizedText }>;
}

export interface RatingSummary {
  average: number;
  count: number;
  breakdown: Record<string, number>;
}

export interface BookOffer {
  productId: string;
  productSlug: string;
  variantId: string | null;
  formatId: string | null;
  condition: string;
  conditionNote: string | null;
  price: string;
  compareAtPrice: string | null;
  /** The e-book edition (sold by its rights holder). */
  isDigital: boolean;
  stock: number;
  store: { name: string; slug: string; district: string | null; ratingAvg: number; ratingCount: number };
}

export interface BookDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  originalTitle: string | null;
  description: string | null;
  language: string;
  ageGroup: string | null;
  academicLevel: string | null;
  seriesName: string | null;
  seriesNumber: number | null;
  firstPublishedYear: number | null;
  isFree: boolean;
  coverUrl: string | null;
  images: Array<{ url: string; alt: string | null; kind: string }>;
  tableOfContents: Array<{ title: string; page?: number }> | null;
  contributors: Array<{ id: string; slug: string; name: string; nameAlt: string | null; role: string; verified: boolean; photoUrl: string | null }>;
  categories: Array<{ slug: string; path: string; name: LocalizedText; primary: boolean }>;
  genres: Array<{ key: string; name: LocalizedText }>;
  formats: Array<{ id: string; format: string; isbn13: string | null; isbn10: string | null; edition: string | null; publicationYear: number | null; pages: number | null; publisher: { name: string; slug: string } | null }>;
  offers: BookOffer[];
  previews: Array<{ id: string; kind: string; title: string | null }>;
  /** The e-book on offer: its file details and whether it's free. */
  digital: { format: 'pdf' | 'epub'; sizeBytes: number; pageCount: number | null; free: boolean } | null;
  rating: RatingSummary;
  picks: { editors: boolean; students: boolean; teachers: boolean };
  related: BookCardData[];
}

export interface ProductVariant {
  id: string;
  name: string;
  options: Record<string, string>;
  price: string;
  compareAtPrice: string | null;
  sku: string | null;
  available: number;
}

export type ProductDetail =
  | { type: 'book'; bookSlug: string | null }
  | {
      type: 'general';
      id: string;
      slug: string;
      title: string;
      description: string | null;
      brand: string | null;
      attributes: Record<string, string>;
      price: string;
      compareAtPrice: string | null;
      images: Array<{ url: string; alt: string | null }>;
      variants: ProductVariant[];
      category: { path: string; name: LocalizedText } | null;
      store: { name: string; slug: string; district: string | null; ratingAvg: number } | null;
      rating: RatingSummary;
      related: ProductCardData[];
    };

export interface AuthorDetail extends AuthorCardData {
  id: string;
  bio: string | null;
  birthYear: number | null;
  deathYear: number | null;
  website: string | null;
  claimed: boolean;
  following: boolean;
  books: BookCardData[];
}

export interface PublisherDetail {
  slug: string;
  name: string;
  nameAlt: string | null;
  description: string | null;
  website: string | null;
  foundedYear: number | null;
  verified: boolean;
  logoUrl: string | null;
  followerCount: number;
  books: BookCardData[];
}

export interface StoreDetail {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  division: string | null;
  district: string | null;
  returnPolicy: string | null;
  shippingPolicy: string | null;
  ratingAvg: number;
  ratingCount: number;
  followerCount: number;
  productCount: number;
  sellerType: string;
  since: string | null;
  books: BookCardData[];
  products: ProductCardData[];
}

export interface SearchResults {
  query: string;
  books: BookCardData[];
  bookTotal?: number;
  authors: AuthorCardData[];
  products: ProductCardData[];
}

export interface Suggestion {
  kind: 'book' | 'author' | 'product' | 'query';
  slug: string;
  label: string;
  detail: string | null;
  imageUrl: string | null;
}

/** Book club response shapes (mirror the API). */
export interface ClubCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: 'public' | 'private' | 'school' | 'college' | 'university';
  purpose: 'reading' | 'study';
  subject: string | null;
  institutionName: string | null;
  joinPolicy: 'open' | 'request' | 'invite';
  coverUrl: string | null;
  memberCount: number;
  currentBook: { title: string; slug: string; coverUrl: string | null } | null;
  membership: { role: 'owner' | 'moderator' | 'member'; status: 'active' | 'pending' | 'invited' | 'banned' | 'left' } | null;
}

export interface ClubPoll {
  id: string;
  question: string;
  allowMultiple: boolean;
  closesAt: string | null;
  open: boolean;
  totalVotes: number;
  options: Array<{ id: string; label: string; votes: number; mine: boolean }>;
}

export interface ClubDetail extends ClubCard {
  rules: string | null;
  createdAt: string;
  owner: { username: string; name: string; avatarUrl: string | null } | null;
  readable: boolean;
  canModerate: boolean;
  isOwner: boolean;
  pendingCount: number;
  books: Array<{
    id: string;
    month: string;
    status: 'current' | 'upcoming' | 'finished';
    book: { id: string; slug: string; title: string; coverUrl: string | null; authors: string[] };
    schedule: Array<{ id: string; title: string; fromPage: number | null; toPage: number | null; dueOn: string }>;
  }>;
  events: Array<{ id: string; title: string; description: string | null; startsAt: string; endsAt: string | null; location: string | null; onlineUrl: string | null }>;
  polls: ClubPoll[];
}

export interface ClubPost {
  id: string;
  parentId: string | null;
  title: string | null;
  body: string;
  kind: 'discussion' | 'announcement';
  pinned: boolean;
  pending: boolean;
  replyCount: number;
  mine: boolean;
  canDelete: boolean;
  author: { username: string; name: string; avatarUrl: string | null };
  createdAt: string;
  replies?: ClubPost[];
}

export interface ClubMember {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  role: 'owner' | 'moderator' | 'member';
  status: string;
  joinedAt: string;
}

/** Commerce response shapes (mirrors the API). */
export interface CartItem {
  variantId: string;
  productId: string;
  productSlug: string;
  type: 'book' | 'general';
  bookId: string | null;
  bookSlug: string | null;
  title: string;
  variantName: string;
  condition: string | null;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: string;
  compareAtPrice: string | null;
  quantity: number;
  savedForLater: boolean;
  available: number;
  state: 'ok' | 'unavailable' | 'insufficient';
  lineTotal: string;
  /** An e-book: one copy, no delivery, downloadable from My Library once paid. */
  isDigital: boolean;
  seller: { id: string; name: string; slug: string };
}

export interface CartView {
  guestToken: string | null;
  couponCode: string | null;
  groups: Array<{ seller: { id: string; name: string; slug: string; district: string | null }; items: CartItem[]; subtotal: string }>;
  saved: CartItem[];
  summary: { itemCount: number; subtotal: string; hasProblems: boolean };
}

export interface Address {
  id: string;
  label: 'home' | 'office' | 'other';
  recipientName: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  union: string | null;
  area: string;
  addressLine: string;
  postcode: string | null;
  isDefault: boolean;
}

export interface ShippingOption {
  code: string;
  name: { bn: string; en: string };
  insideDhakaFee: string;
  outsideDhakaFee: string;
  freeShippingThreshold: string | null;
  minDays: number;
  maxDays: number;
  supportsCod: boolean;
}

export interface Quote {
  groups: Array<{
    seller: { id: string; name: string; slug: string };
    itemsSubtotal: string;
    itemDiscount: string;
    shippingFee: string;
    shippingDiscount: string;
    total: string;
    items: Array<{ variantId: string; title: string; variantName: string; condition: string | null; imageUrl: string | null; quantity: number; unitPrice: string; discount: string; lineTotal: string }>;
  }>;
  problems: Array<{ variantId: string; title: string; state: string; available: number }>;
  coupon: { code: string; applied: boolean; discount: string; message?: string } | null;
  totals: { itemCount: number; itemsSubtotal: string; discountTotal: string; shippingTotal: string; grandTotal: string; shippingPending: boolean; digitalOnly: boolean; hasDigital: boolean };
  paymentMethods: Array<{ method: string; provider: string; available: boolean; reason?: string }>;
}

export interface OrderSummary {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  grandTotal: string;
  placedAt: string;
  paymentDueAt: string | null;
  itemCount: number;
  preview: Array<{ title: string; imageUrl: string | null }>;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  bookId: string | null;
  title: string;
  variantName: string | null;
  condition: string | null;
  isDigital: boolean;
  imageUrl: string | null;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  lineTotal: string;
  refundedQuantity: number;
  /** Book or product page (where the item is reviewed); null when the listing is gone. */
  path: string | null;
}

export interface OrderDetail {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totals: { itemsSubtotal: string; discountTotal: string; shippingTotal: string; grandTotal: string; refundedTotal: string };
  couponCode: string | null;
  shippingAddress: Omit<Address, 'id' | 'label' | 'isDefault'>;
  note: string | null;
  placedAt: string;
  paidAt: string | null;
  paymentDueAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  canCancel: boolean;
  canPay: boolean;
  payment: { id: string; method: string; status: string; redirectUrl: string | null; failureReason: string | null } | null;
  sellerOrders: Array<{
    id: string;
    number: string;
    status: string;
    store: { name: string; slug: string };
    itemsSubtotal: string;
    discountTotal: string;
    shippingFee: string;
    total: string;
    shippedAt: string | null;
    deliveredAt: string | null;
    cancelReason: string | null;
    returnableUntil: string | null;
    shipment: { courier: string; trackingNumber: string | null; trackingUrl: string | null; status: string; events: Array<{ status: string; note: string | null; location: string | null; at: string }> } | null;
    items: OrderItem[];
  }>;
  refunds: Array<{ id: string; sellerOrderId: string | null; amount: string; status: string; reason: string; createdAt: string; processedAt: string | null }>;
  returns: Array<{ id: string; sellerOrderId: string; status: string; reason: string; details: string | null; sellerNote: string | null; items: Array<{ orderItemId: string; quantity: number }>; createdAt: string }>;
  history: Array<{ status: string; note: string | null; actorRole: string | null; sellerOrderId: string | null; at: string }>;
}

export interface CheckoutResult {
  order: { id: string; number: string; status: string; paymentStatus: string; paymentMethod: string; grandTotal: string; paymentDueAt: string | null };
  payment: { id: string; method: string; status: string; redirectUrl: string | null; failureReason: string | null } | null;
}

/** Community response shapes (mirrors the API). */
export interface PostView {
  id: string;
  type: string;
  title: string | null;
  body: string;
  quoteSource: string | null;
  readingPercent: number | null;
  visibility: 'public' | 'followers' | 'private';
  studentZone: boolean;
  subject: string | null;
  status: string;
  book: { id: string; slug: string; title: string; coverUrl: string | null; authors: string[] } | null;
  media: Array<{ url: string; alt: string | null; width: number | null; height: number | null }>;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  liked: boolean;
  bookmarked: boolean;
  mine: boolean;
  author: { id: string; username: string; name: string; avatarUrl: string | null; isAuthor: boolean };
  createdAt: string;
  editedAt: string | null;
}

export interface CommentView {
  id: string;
  parentId: string | null;
  body: string | null;
  deleted: boolean;
  pending: boolean;
  likeCount: number;
  replyCount: number;
  liked: boolean;
  mine: boolean;
  canDelete: boolean;
  author: { id: string; username: string; name: string; avatarUrl: string | null };
  createdAt: string;
  editedAt: string | null;
  replies?: CommentView[];
}

export interface BookTag {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  authors: string[];
}

export interface ArticleCard {
  id: string;
  slug: string;
  kind: ArticleKind;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  language: string;
  audience: string;
  tags: string[];
  readMinutes: number;
  author: { name: string; username: string | null; avatarUrl: string | null } | null;
  publishedAt: string | null;
}

export interface ArticleDetail extends ArticleCard {
  body: string;
  viewCount: number;
  updatedAt: string;
  related: ArticleCard[];
}

export interface CmsPage {
  slug: string;
  title: LocalizedText;
  body: LocalizedText;
  seoDescription: string | null;
  updatedAt: string;
}

export interface Faq {
  id: string;
  category: string;
  question: LocalizedText;
  answer: LocalizedText;
}

export interface Banner {
  id: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  ctaLabel: LocalizedText;
  link: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
}

export interface Testimonial {
  id: string;
  name: string;
  role: LocalizedText;
  quote: LocalizedText;
  avatarUrl: string | null;
}

/** Notification shapes (mirror the API). */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  pushAvailable: boolean;
  hasPushDevice: boolean;
  types: Array<{ type: NotificationType; mandatory: boolean; channels: Array<{ channel: NotificationChannel; enabled: boolean }> }>;
}

/** Reading & library response shapes (mirror the API). */
export interface LibraryItem {
  book: { id: string; slug: string; title: string; coverUrl: string | null; authors: string[]; rating: number };
  shelf: LibraryShelf;
  source: string;
  hasDigitalAccess: boolean;
  progress: { currentPage: number; totalPages: number | null; percent: number; finishedAt: string | null };
  addedAt: string;
  updatedAt: string;
}

export interface LibraryPage {
  items: LibraryItem[];
  shelves: Partial<Record<LibraryShelf, number>>;
  /** Books whose e-book I can download. */
  digitalCount: number;
  page: number;
  pageSize: number;
  total: number;
}

export interface ReadingGoals {
  dailyMinutes: number;
  weeklyMinutes: number;
  yearlyBooks: number;
  breakReminderMinutes: number | null;
  monthlySummaryEmail: boolean;
}

export interface ReadingStats {
  days: number;
  series: Array<{ day: string; minutes: number; pages: number }>;
  today: { minutes: number; goal: number };
  week: { minutes: number; goal: number };
  year: { books: number; goal: number };
  period: { minutes: number; pages: number };
  streak: { current: number; longest: number; lastReadOn: string | null };
  level: { level: number; xp: number; levelStartXp: number; nextLevelXp: number };
  totals: { booksCompleted: number; pagesRead: number; minutesRead: number };
  recentSessions: Array<{ id: string; minutes: number; pages: number; day: string; source: string; book: { title: string; slug: string } | null }>;
  goals: ReadingGoals;
}

export interface BadgeProgress {
  key: string;
  icon: string;
  name: Record<string, string>;
  description: Record<string, string>;
  xpReward: number;
  metric: string;
  target: number;
  current: number;
  earnedAt: string | null;
}

export interface Challenge {
  id: string;
  slug: string;
  title: Record<string, string>;
  description: Record<string, string>;
  type: 'days' | 'pages' | 'books' | 'minutes';
  target: number;
  durationDays: number | null;
  genreKey: string | null;
  language: string | null;
  xpReward: number;
  participantCount: number;
  endsAt: string | null;
  mine: { status: 'active' | 'completed' | 'abandoned' | 'expired'; progress: number; joinedAt: string; deadlineAt: string | null; completedAt: string | null } | null;
}

/** Student Zone response shapes (mirror the API). */
export interface QuizCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  subject: string;
  academicLevel: string;
  language: string;
  timeLimitSeconds: number | null;
  passPercent: number;
  attemptCount: number;
  questionCount: number;
  best: number | null;
  passed: boolean;
}

export interface QuizDetail extends QuizCard {
  questions: Array<{ id: string; prompt: string; options: string[] }>;
  myAttempts: Array<{ score: number; passed: boolean; completedAt: string }>;
}

export interface QuizResult {
  scorePercent: number;
  correctCount: number;
  total: number;
  passed: boolean;
  late: boolean;
  passPercent: number;
  firstPass: boolean;
  results: Array<{ questionId: string; chosen: number; correctIndex: number; correct: boolean; explanation: string | null }>;
}

export interface EducationEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  audience: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  onlineUrl: string | null;
  organizer: string | null;
  coverUrl: string | null;
}

export interface Competition {
  id: string;
  slug: string;
  title: string;
  kind: string;
  rules: string;
  prizes: string | null;
  audience: string;
  startsAt: string;
  endsAt: string;
  status: 'draft' | 'open' | 'judging' | 'closed';
  entryCount: number;
}

export interface Scholarship {
  id: string;
  slug: string;
  title: string;
  provider: string;
  description: string;
  eligibility: string | null;
  amountText: string | null;
  academicLevel: string | null;
  deadline: string | null;
  applyUrl: string | null;
}

export interface StudentHome {
  quizzes: QuizCard[];
  events: EducationEvent[];
  competitions: Competition[];
  scholarships: Scholarship[];
  studyGroups: Array<{ slug: string; name: string; subject: string | null; memberCount: number; institutionName: string | null }>;
  textbooks: BookCardData[];
}

export interface StudyNote {
  id: string;
  title: string;
  body: string;
  subject: string | null;
  page: number | null;
  visibility: 'public' | 'followers' | 'private';
  book: { title: string; slug: string } | null;
  updatedAt: string;
}

export type EbookFormat = 'pdf' | 'epub';

export type AssetStatus = 'active' | 'withdrawn' | 'replaced' | 'removed';

export interface DownloadLink {
  url: string;
  expiresAt: string;
  fileName: string;
  format: EbookFormat;
  sizeBytes: number;
  remainingToday: number;
}

export interface DownloadEntry {
  id: string;
  at: string;
  fileName: string;
  format: EbookFormat;
  sizeBytes: number;
  available: boolean;
  book: { id: string; slug: string; title: string; coverUrl: string | null };
}

export interface HistoryEntry {
  id: string;
  event: 'started' | 'finished' | 'downloaded' | string;
  at: string;
  book: { id: string; slug: string; title: string; coverUrl: string | null };
}

export interface StudioPreview {
  id: string;
  kind: 'pdf' | 'sample_chapter' | 'sample_pages';
  title: string | null;
  previewPercent: number;
  pages: number;
  chars: number;
  samplePages: number | null;
}

export interface StudioEdition {
  book: { id: string; slug: string; title: string; coverUrl: string | null };
  capacities: Array<'author' | 'publisher'>;
  asset: { id: string; fileName: string; format: EbookFormat; sizeBytes: number; pageCount: number | null; status: AssetStatus; removedReason: string | null; uploadedAt: string } | null;
  offer: { mode: 'free' } | { mode: 'paid'; price: string; compareAtPrice: string | null; status: string; productSlug: string } | null;
  lastPrice: string | null;
  onSale: boolean;
  offeredByOther: boolean;
  sales: number;
  downloads: number;
  readers: number;
  previews: StudioPreview[];
}

export interface StudioData {
  editions: StudioEdition[];
  canSell: boolean;
  previewMaxPercent: number;
}

export interface BookPreviewData {
  book: { id: string; slug: string; title: string; subtitle: string | null; coverUrl: string | null; description: string | null; authors: string[]; tableOfContents: Array<{ title: string; page?: number }> | null };
  digital: { format: EbookFormat; pageCount: number | null; sizeBytes: number; isFree: boolean } | null;
  previews: Array<{ id: string; kind: 'pdf' | 'sample_chapter' | 'sample_pages'; title: string | null; content: string | null; pages: string[]; pdfUrl: string | null; samplePages: number | null; previewPercent: number }>;
}

export interface AdminDigitalFile {
  id: string;
  fileName: string;
  format: EbookFormat;
  sizeBytes: number;
  pageCount: number | null;
  status: AssetStatus;
  removedReason: string | null;
  uploadedAt: string;
  sha256: string;
  downloads: number;
  uploader: { name: string; username: string | null } | null;
  declaration: { capacity: string; statement: string; at: string } | null;
  book: { id: string; slug: string; title: string; coverUrl: string | null };
}

export interface WishlistData {
  books: Array<BookCardData & { savedAt: string }>;
  products: Array<ProductCardData & { available: boolean; savedAt: string }>;
}
