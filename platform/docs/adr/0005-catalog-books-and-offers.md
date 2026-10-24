# 0005 — Books, editions and per-seller offers

## Context
Many sellers list the same book, in new and used conditions. Customers expect one book page with
reviews, previews and every offer, while sellers manage their own price and stock.

## Decision
- `books`: the bibliographic work as shown in the store (title, description, authors, categories,
  genres, aggregates such as rating, lowest price and offer count).
- `book_formats`: a concrete edition/format (hardcover, paperback, digital, audiobook) with ISBN-13
  unique when present. Listing an ISBN that exists attaches the seller's offer to that edition.
- `products`: a seller's offer (`type = book` with `book_id`/`book_format_id`, or `type = general`
  for stationery, bags, electronics…). Condition: new, used – like new, used – good,
  used – acceptable. A seller lists a given edition in a given condition once.
- Every product has at least one `product_variant` (a single default variant when there are no
  options); stock is per variant in `inventory`.

## Consequences
- Reviews, previews and reading data attach to the book, not to one seller's listing.
- Aggregates (`min_price`, `offer_count`, `total_stock`) are refreshed by helpers in the database
  package whenever offers change.
