# Design system

The single source of truth is `shared/src/design/tokens.ts`. The web build writes the tokens to
`web/src/styles/tokens.css` (`pnpm --filter @boikonika/web tokens`) and Tailwind maps them to
semantic utilities; the mobile app imports the same object.

The living style guide is at `/design-system` (not indexed by search engines) and shows every
token and component in both themes.

## Colour

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Primary | `#2563EB` (white text) | `#60A5FA` (text `#0F172A`) | Main actions, links, focus |
| Secondary | `#0F766E` (white text) | `#14B8A6` (text `#042F2E`) | Seller and learning actions |
| Accent | `#F59E0B` (text `#1F1300`) | `#FBBF24` | Highlights, badges, ratings — a fill, never text on white |
| Background | `#F8FAFC` | `#0F172A` | Page canvas |
| Card / surface | `#FFFFFF` | `#16213A` (raised `#1C2945`) | Cards, sheets, dialogs |
| Text | `#0F172A` | `#E2E8F0` | Body text |
| Secondary text | `#64748B` (`textSubtle`); `#475569` (`textMuted`) for longer supporting text | `#8A99B2` / `#B4C0D3` | Supporting text |
| Success | `#16A34A` | `#22C55E` | Confirmations (icons; text uses `success-soft-fg`) |
| Warning | `#F59E0B` | `#FBBF24` | Cautions (fills; text uses `warning-soft-fg`) |
| Error | `#DC2626` | `#F87171` | Errors, destructive actions |
| Input border | `#7D8BA1` | `#667896` | Form-control boundaries (3:1, WCAG 1.4.11) |

The dark palette is designed separately rather than inverted. Dark primary and danger fills are
light enough to carry dark text, because white text on a mid blue or red cannot reach 4.5:1.

Each role has `-hover`, `-fg` (text on the colour), `-soft` (tinted background) and `-soft-fg`
variants, so components never compute colours. Tailwind's default palette is disabled: only
tokens can be used (`bg-surface`, `text-fg-muted`, `bg-primary`, `border-line`…).

Contrast: body text and every `-fg` pair meet WCAG 2.2 AA (4.5:1); form-control borders, focus rings and
meaningful icons meet 3:1. `shared/src/design/tokens.test.ts` checks every pair in both themes, so a
token change that breaks contrast fails CI.

## Typography

- Bangla: **Noto Sans Bengali** (variable); Latin: **Inter** (variable). Both are self-hosted
  through `@fontsource-variable`, so no third-party font requests are made.
- Scale (rem): xs 0.75 · sm 0.875 · base 1 · lg 1.125 · xl 1.25 · 2xl 1.5 · 3xl 1.875 · 4xl 2.25 · 5xl 3.
- Bangla text uses a taller line height (1.7) than Latin (1.5) because of conjuncts and vowel signs.

## Layout and spacing

4 px spacing grid; content width 1280 px (`container-page`); breakpoints sm 640, md 768, lg 1024,
xl 1280. Mobile-first: on phones a bottom tab bar (Home, Explore, Community, Library, Profile)
replaces the header navigation.

## Radius, elevation, motion

Radius sm 6 · md 10 · lg 14 · xl 20 · full. Three shadow levels, softer in dark mode. Motion
durations 120/200/320 ms with a standard ease; everything respects `prefers-reduced-motion`.

## Components

`Button` (primary, secondary, accent, outline, ghost, danger; sizes sm/md/lg; loading state),
`Field`/`Input`/`Select`/`Textarea` with labels, hints and errors wired to `aria-describedby`,
`Card`, `Badge`, `Alert`, `Avatar`, `Rating`, `Price` (BDT, Bangla digits, discount),
`BookCover` (generated typographic cover when no image exists), `Skeleton`, `EmptyState`,
`ErrorState`, `Tabs`, `Dialog` (focus trap, Escape to close), `Toast` (live region),
`SectionHeader`.

## Accessibility rules

- Every interactive element is reachable by keyboard and shows a visible focus ring (`ring` token).
- Touch targets are at least 44 × 44 px.
- Icons that carry meaning have labels; decorative icons are `aria-hidden`.
- Colour is never the only signal (status badges include text).
- Pages have one `h1`, landmarks (`header`, `nav`, `main`, `footer`) and a skip link.

## Dark mode

`data-theme="light|dark"` on `<html>`, set by an inline script before first paint from the saved
choice (`bk-theme` in localStorage) or the system preference. Every token has a dark value; no
component uses hard-coded colours.
