export const USER_STATUSES = ['active', 'suspended', 'banned', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const VISIBILITIES = ['public', 'followers', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const KYC_STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'resubmission_required'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const KYC_PURPOSES = ['seller', 'author', 'publisher', 'student', 'teacher', 'institution'] as const;
export type KycPurpose = (typeof KYC_PURPOSES)[number];

export const KYC_DOCUMENT_TYPES = [
  'nid',
  'passport',
  'driving_license',
  'trade_license',
  'tin',
  'publisher_document',
  'student_id',
  'teacher_id',
  'institution_document',
  'selfie',
] as const;
export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];

export const PRODUCT_TYPES = ['book', 'general'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_STATUSES = ['draft', 'pending_review', 'active', 'rejected', 'archived', 'suspended'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const BOOK_CONDITIONS = ['new', 'used_like_new', 'used_good', 'used_acceptable'] as const;
export type BookCondition = (typeof BOOK_CONDITIONS)[number];

export const BOOK_FORMATS = ['hardcover', 'paperback', 'digital', 'audiobook'] as const;
export type BookFormat = (typeof BOOK_FORMATS)[number];

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed seller sub-order transitions; anything else is rejected by the API. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'returned'],
  out_for_delivery: ['delivered', 'returned'],
  delivered: ['returned', 'refunded'],
  cancelled: ['refunded'],
  returned: ['refunded'],
  refunded: [],
};

export const PAYMENT_STATUSES = ['pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['cod', 'bkash', 'nagad', 'rocket', 'card', 'internet_banking', 'sandbox'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const REFUND_STATUSES = ['requested', 'approved', 'rejected', 'processing', 'completed', 'failed'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const PAYOUT_STATUSES = ['pending', 'processing', 'paid', 'failed', 'cancelled'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const SHIPMENT_STATUSES = ['pending', 'packed', 'handed_to_courier', 'in_transit', 'out_for_delivery', 'delivered', 'failed_attempt', 'returned'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const POST_TYPES = [
  'review',
  'recommendation',
  'quote',
  'reading_progress',
  'poem',
  'story',
  'essay',
  'study_tip',
  'educational',
  'question',
  'discussion',
  'artwork',
  'announcement',
] as const;
export type PostType = (typeof POST_TYPES)[number];

export const REPORT_REASONS = ['spam', 'scam', 'fake_product', 'copyright', 'abuse', 'harassment', 'inappropriate', 'fraud', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['reported', 'under_review', 'action_taken', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MODERATION_ACTIONS = ['warning', 'content_removal', 'temporary_restriction', 'suspension', 'ban', 'no_action'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const CLUB_TYPES = ['public', 'private', 'school', 'college', 'university'] as const;
export type ClubType = (typeof CLUB_TYPES)[number];

export const LIBRARY_SHELVES = ['purchased', 'owned', 'currently_reading', 'completed', 'want_to_read'] as const;
export type LibraryShelf = (typeof LIBRARY_SHELVES)[number];

export const CHALLENGE_TYPES = ['days', 'pages', 'books', 'minutes'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'push', 'email', 'sms'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPES = [
  'order',
  'delivery',
  'follower',
  'comment',
  'review',
  'book_release',
  'author_update',
  'book_club',
  'reading_challenge',
  'security',
  'kyc',
  'payout',
  'listing',
  'announcement',
  /** Moderation and copyright decisions about the reader's account or content. */
  'moderation',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const COPYRIGHT_CLAIM_STATUSES = ['submitted', 'under_review', 'content_removed', 'rejected', 'counter_noticed', 'restored'] as const;
export type CopyrightClaimStatus = (typeof COPYRIGHT_CLAIM_STATUSES)[number];

/** Default delivery channels per notification type (used when the user has not changed a setting). */
export const DEFAULT_NOTIFICATION_CHANNELS: Record<NotificationType, NotificationChannel[]> = {
  order: ['in_app', 'push', 'email', 'sms'],
  delivery: ['in_app', 'push', 'sms'],
  follower: ['in_app'],
  comment: ['in_app', 'push'],
  review: ['in_app'],
  book_release: ['in_app', 'push', 'email'],
  author_update: ['in_app'],
  book_club: ['in_app', 'push'],
  reading_challenge: ['in_app', 'push'],
  security: ['in_app', 'push', 'email', 'sms'],
  kyc: ['in_app', 'push', 'email'],
  payout: ['in_app', 'email'],
  listing: ['in_app', 'email'],
  announcement: ['in_app'],
  moderation: ['in_app', 'push', 'email'],
};

/** Types users cannot switch off (account security). */
export const MANDATORY_NOTIFICATION_TYPES: readonly NotificationType[] = ['security', 'moderation'];

/** Channels a reader can choose for each type. SMS costs money, so it is offered only where it matters. */
export const NOTIFICATION_CHANNEL_OPTIONS: Record<NotificationType, NotificationChannel[]> = {
  order: ['in_app', 'push', 'email', 'sms'],
  delivery: ['in_app', 'push', 'email', 'sms'],
  follower: ['in_app', 'push', 'email'],
  comment: ['in_app', 'push', 'email'],
  review: ['in_app', 'push', 'email'],
  book_release: ['in_app', 'push', 'email'],
  author_update: ['in_app', 'push', 'email'],
  book_club: ['in_app', 'push', 'email'],
  reading_challenge: ['in_app', 'push', 'email'],
  security: ['in_app', 'push', 'email', 'sms'],
  kyc: ['in_app', 'push', 'email'],
  payout: ['in_app', 'push', 'email'],
  listing: ['in_app', 'push', 'email'],
  announcement: ['in_app', 'push', 'email'],
  moderation: ['in_app', 'push', 'email'],
};

/** Who an announcement goes to. */
export const BROADCAST_AUDIENCES = ['everyone', 'students', 'teachers', 'sellers', 'authors', 'publishers'] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];
