# 0007 — PostgreSQL full-text + trigram search

## Context
Readers search in Bangla, English and transliterated Bangla ("rabindranath"), make typos, and search
by ISBN. A separate search cluster adds cost and operational work that the launch does not need.

## Decision
- Generated `tsvector` columns (`simple` configuration, which tokenises Bangla correctly) with
  weights: title A, subtitle/authors/publishers/ISBN B, description D.
- `search_text` holds denormalised author names in both scripts, publisher names, ISBNs and tags,
  built by `buildSearchText()` so the API and seeds produce the same text.
- `pg_trgm` GIN indexes on titles and names for typo-tolerant matching and autocomplete.
- A `SearchService` interface isolates queries so OpenSearch/Meilisearch can replace PostgreSQL
  later without touching controllers.

## Consequences
- One database to operate; search is transactionally consistent with the catalogue.
- Very large catalogues (millions of offers) may need the external engine; the interface allows it.
