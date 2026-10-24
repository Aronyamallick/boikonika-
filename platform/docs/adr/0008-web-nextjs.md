# 0008 — Next.js App Router, Tailwind v4 tokens, Bangla-first i18n

## Context
Book pages must be indexable (SEO), fast on mid-range Android phones over mobile data, accessible,
and available in Bangla and English with full dark mode.

## Decision
- Next.js 15 App Router with server components; static generation for public pages where possible.
- next-intl: Bangla at `/`, English at `/en` (`localePrefix: 'as-needed'`); every string comes from
  the shared message files.
- Tailwind CSS v4 configured CSS-first: design tokens from `@boikonika/shared` are written to CSS
  variables (`tokens.css`) and mapped to semantic utilities (`bg-surface`, `text-fg`,
  `bg-primary`…). The default palette is removed so only brand tokens can be used.
- Dark mode via `data-theme` set before first paint (no flash), following the system setting until
  the user chooses.
- PWA: web app manifest, service worker for offline shell and cached assets.

## Consequences
- Designers change a token once and web and mobile follow.
- Hard-coded colours or strings fail review; the design-system page is the visual QA reference.
