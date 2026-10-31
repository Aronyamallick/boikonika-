# 0004 — Money as NUMERIC(14,2) plus currency

## Context
Floating-point arithmetic loses poisha (e.g. 0.1 + 0.2). Commission, VAT-inclusive prices, coupons,
partial refunds and payouts must reconcile exactly.

## Decision
- Database: `NUMERIC(14,2)` with a `currency CHAR(3)` column (BDT today, more later).
- Application: values travel as decimal strings (`"1250.00"`) and are converted to integer poisha
  (`125000`) for arithmetic using `@boikonika/shared` money helpers; rounding happens once, at the
  end, half-up.
- Display: Bangladeshi grouping (১,২৫,০০০.০০ ৳) with Bangla or Latin digits by locale.

## Consequences
- No float ever touches money. Totals are recomputed on the server; client-sent prices are ignored.
