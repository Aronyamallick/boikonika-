import { pgEnum } from 'drizzle-orm/pg-core';
import {
  BOOK_CONDITIONS,
  BOOK_FORMATS,
  CHALLENGE_TYPES,
  CLUB_TYPES,
  COPYRIGHT_CLAIM_STATUSES,
  KYC_DOCUMENT_TYPES,
  KYC_PURPOSES,
  KYC_STATUSES,
  LIBRARY_SHELVES,
  MODERATION_ACTIONS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  POST_TYPES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  REFUND_STATUSES,
  REPORT_REASONS,
  REPORT_STATUSES,
  ROLES,
  SHIPMENT_STATUSES,
  USER_STATUSES,
  VISIBILITIES,
} from '@boikonika/shared';

export const userStatusEnum = pgEnum('user_status', USER_STATUSES);
export const roleKeyEnum = pgEnum('role_key', ROLES);
export const visibilityEnum = pgEnum('visibility', VISIBILITIES);
export const kycStatusEnum = pgEnum('kyc_status', KYC_STATUSES);
export const kycPurposeEnum = pgEnum('kyc_purpose', KYC_PURPOSES);
export const kycDocumentTypeEnum = pgEnum('kyc_document_type', KYC_DOCUMENT_TYPES);
export const productTypeEnum = pgEnum('product_type', PRODUCT_TYPES);
export const productStatusEnum = pgEnum('product_status', PRODUCT_STATUSES);
export const bookConditionEnum = pgEnum('book_condition', BOOK_CONDITIONS);
export const bookFormatEnum = pgEnum('book_format', BOOK_FORMATS);
export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES);
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);
export const refundStatusEnum = pgEnum('refund_status', REFUND_STATUSES);
export const payoutStatusEnum = pgEnum('payout_status', PAYOUT_STATUSES);
export const shipmentStatusEnum = pgEnum('shipment_status', SHIPMENT_STATUSES);
export const postTypeEnum = pgEnum('post_type', POST_TYPES);
export const reportReasonEnum = pgEnum('report_reason', REPORT_REASONS);
export const reportStatusEnum = pgEnum('report_status', REPORT_STATUSES);
export const moderationActionEnum = pgEnum('moderation_action', MODERATION_ACTIONS);
export const clubTypeEnum = pgEnum('club_type', CLUB_TYPES);
export const libraryShelfEnum = pgEnum('library_shelf', LIBRARY_SHELVES);
export const challengeTypeEnum = pgEnum('challenge_type', CHALLENGE_TYPES);
export const notificationChannelEnum = pgEnum('notification_channel', NOTIFICATION_CHANNELS);
export const notificationTypeEnum = pgEnum('notification_type', NOTIFICATION_TYPES);
export const copyrightClaimStatusEnum = pgEnum('copyright_claim_status', COPYRIGHT_CLAIM_STATUSES);

export const contentStatusEnum = pgEnum('content_status', ['draft', 'pending_review', 'published', 'hidden', 'removed']);
export const sellerStatusEnum = pgEnum('seller_status', ['pending', 'active', 'suspended', 'closed']);
export const sellerTypeEnum = pgEnum('seller_type', ['book_seller', 'general_seller', 'publisher', 'author']);
export const otpPurposeEnum = pgEnum('otp_purpose', ['register', 'login', 'verify_phone', 'verify_email', 'reset_password', 'change_contact']);
export const loginResultEnum = pgEnum('login_result', ['success', 'failed_password', 'failed_2fa', 'blocked', 'locked']);
export const memberRoleEnum = pgEnum('member_role', ['owner', 'moderator', 'member']);
export const memberStatusEnum = pgEnum('member_status', ['active', 'pending', 'invited', 'banned', 'left']);
export const joinPolicyEnum = pgEnum('join_policy', ['open', 'request', 'invite']);
export const clubPurposeEnum = pgEnum('club_purpose', ['reading', 'study']);
export const couponTypeEnum = pgEnum('coupon_type', ['percent', 'fixed', 'free_shipping']);
export const movementReasonEnum = pgEnum('inventory_movement_reason', ['initial', 'restock', 'adjustment', 'order_reserved', 'order_released', 'order_fulfilled', 'return', 'damaged']);
export const returnStatusEnum = pgEnum('return_status', ['requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled']);
export const articleKindEnum = pgEnum('article_kind', ['blog', 'educational', 'announcement', 'study_resource', 'help']);
export const audienceEnum = pgEnum('audience', ['all', 'student', 'teacher', 'parent', 'seller', 'author']);
export const sectionTypeEnum = pgEnum('homepage_section_type', [
  'hero',
  'book_list',
  'author_list',
  'category_grid',
  'banner',
  'student_zone',
  'book_clubs',
  'reading_challenges',
  'featured_sellers',
  'articles',
  'testimonials',
  'why_choose_us',
]);
export const challengeStatusEnum = pgEnum('challenge_participant_status', ['active', 'completed', 'abandoned']);
export const competitionStatusEnum = pgEnum('competition_status', ['draft', 'open', 'judging', 'closed']);
export const outboxStatusEnum = pgEnum('outbox_status', ['queued', 'sent', 'failed']);
