import type { Role } from './roles';

/**
 * Granular permission catalogue. Staff screens and admin APIs are guarded by these.
 * Marketplace capabilities (a seller editing *their own* product) are guarded by
 * role + ownership checks in the service layer, not by these permissions.
 */
export const PERMISSIONS = {
  'users.view': 'View users',
  'users.edit': 'Edit users',
  'users.ban': 'Suspend and ban users',
  'users.roles.manage': 'Grant and revoke user roles',
  'roles.view': 'View roles and permissions',
  'roles.manage': 'Edit role permissions',
  'kyc.view': 'View identity verifications',
  'kyc.documents.view': 'Open private identity documents',
  'kyc.approve': 'Approve identity verifications',
  'kyc.reject': 'Reject identity verifications',
  'sellers.view': 'View sellers',
  'sellers.manage': 'Approve, suspend and edit sellers',
  'authors.manage': 'Manage author profiles',
  'publishers.manage': 'Manage publisher profiles',
  'books.view': 'View catalogue books',
  'books.create': 'Create catalogue books',
  'books.edit': 'Edit catalogue books',
  'books.delete': 'Delete catalogue books',
  'products.view': 'View all products',
  'products.moderate': 'Approve, hide and edit any product',
  'products.delete': 'Delete any product',
  'categories.manage': 'Manage categories, genres and tags',
  'orders.view': 'View all orders',
  'orders.manage': 'Update any order',
  'orders.refund': 'Approve refunds',
  'payments.view': 'View payments',
  'payouts.view': 'View seller payouts',
  'payouts.manage': 'Process seller payouts',
  'coupons.manage': 'Manage platform coupons',
  'shipping.manage': 'Manage shipping methods and couriers',
  'reviews.moderate': 'Moderate reviews',
  'reports.view': 'View reports',
  'reports.resolve': 'Act on reports',
  'community.moderate': 'Moderate posts and comments',
  'clubs.manage': 'Manage book clubs',
  'challenges.manage': 'Manage reading challenges and badges',
  'student.manage': 'Manage student zone content',
  'copyright.manage': 'Handle copyright complaints',
  'notifications.broadcast': 'Send announcements',
  'banners.manage': 'Manage banners',
  'cms.manage': 'Manage pages, articles and FAQs',
  'homepage.manage': 'Configure the homepage',
  'analytics.view': 'View analytics',
  'settings.manage': 'Change system settings',
  'audit.view': 'View audit logs',
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

const all = PERMISSION_KEYS;
const moderatorPermissions: Permission[] = [
  'users.view',
  'kyc.view',
  'books.view',
  'products.view',
  'products.moderate',
  'reviews.moderate',
  'reports.view',
  'reports.resolve',
  'community.moderate',
  'clubs.manage',
  'copyright.manage',
];

/** Default permissions per staff role (super_admin implicitly has every permission). */
export const DEFAULT_ROLE_PERMISSIONS: Partial<Record<Role, Permission[]>> = {
  super_admin: all,
  admin: all.filter((p) => p !== 'roles.manage' && p !== 'settings.manage'),
  moderator: moderatorPermissions,
};
