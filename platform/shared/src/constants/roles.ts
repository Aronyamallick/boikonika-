/** Platform roles. A user may hold several at once (e.g. author + book_seller + customer). */
export const ROLES = [
  'super_admin',
  'admin',
  'moderator',
  'customer',
  'student',
  'teacher',
  'author',
  'publisher',
  'book_seller',
  'general_seller',
  'institution',
  'delivery_staff',
] as const;
export type Role = (typeof ROLES)[number];

/** Roles a user may request for themselves; the rest are granted by staff. */
export const SELF_SERVICE_ROLES: readonly Role[] = ['customer', 'student', 'teacher', 'author', 'publisher', 'book_seller', 'general_seller', 'institution'];

/** Roles that require an approved identity verification before the capability is active. */
export const KYC_REQUIRED_ROLES: readonly Role[] = ['author', 'publisher', 'book_seller', 'general_seller', 'institution'];

export const SELLER_ROLES: readonly Role[] = ['book_seller', 'general_seller', 'publisher', 'author'];

export const STAFF_ROLES: readonly Role[] = ['super_admin', 'admin', 'moderator'];
