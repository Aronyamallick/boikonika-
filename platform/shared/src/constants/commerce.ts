/** Commerce constants shared by the web/mobile forms and the API (no zod here: kept out of browser bundles). */
export const ADDRESS_LABELS = ['home', 'office', 'other'] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export const MAX_CART_QUANTITY = 99;
export const MAX_CART_LINES = 50;
export const MAX_WISHLIST_ITEMS = 200;

export const RETURN_REASONS = ['damaged', 'wrong_item', 'not_as_described', 'missing_parts', 'changed_mind', 'other'] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const COURIERS = ['manual', 'pathao', 'steadfast', 'redx', 'sundarban', 'paperfly', 'sa_paribahan'] as const;
export type Courier = (typeof COURIERS)[number];

export const PAYOUT_METHODS = ['bkash', 'nagad', 'rocket', 'bank'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

/** Status changes a seller may make on their own sub-order (delivery/return are confirmed separately). */
export const SELLER_ORDER_ACTIONS = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'] as const;

/** Inside-Dhaka delivery fee applies to these districts (the courier industry's "inside Dhaka" zone). */
export const INSIDE_DHAKA_DISTRICTS = ['dhaka'] as const;

/** Online methods must be paid within the payment window; COD is paid on delivery. */
export const ONLINE_PAYMENT_METHODS = ['bkash', 'nagad', 'rocket', 'card', 'internet_banking', 'sandbox'] as const;
