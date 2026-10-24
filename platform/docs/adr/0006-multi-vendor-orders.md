# 0006 — Orders split into seller orders

## Context
A cart can contain items from several sellers. Each seller confirms, packs and ships separately,
earns a commission-adjusted payout and handles returns for their items only.

## Decision
`orders` (customer-facing totals and payment) → `seller_orders` (one per seller: own status,
shipping fee, commission, payout state) → `order_items` (title, price and seller snapshots) →
`shipments` per seller order. Status changes follow `ORDER_STATUS_TRANSITIONS` in the shared
package and are recorded in `order_status_history`.

## Consequences
- Seller isolation is structural: seller endpoints query by `seller_orders.seller_id`, so a seller
  cannot reach another seller's items or the customer's other purchases.
- The customer's order status is derived from its seller orders (e.g. "partially shipped").
- Refunds can target a whole order, a seller order or individual items.
