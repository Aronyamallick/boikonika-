import { colors, type ColorScheme, type SemanticColors } from './tokens';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

type Key = keyof SemanticColors;
/** [foreground, background, minimum ratio] — 4.5 for text (WCAG 1.4.3), 3 for UI boundaries and icons (1.4.11). */
const PAIRS: Array<[Key, Key, number]> = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surfaceRaised', 4.5],
  ['textMuted', 'bg', 4.5],
  ['textMuted', 'surface', 4.5],
  ['textSubtle', 'bg', 4.5],
  ['textSubtle', 'surface', 4.5],
  ['primaryFg', 'primary', 4.5],
  ['primaryFg', 'primaryHover', 4.5],
  ['secondaryFg', 'secondary', 4.5],
  ['secondaryFg', 'secondaryHover', 4.5],
  ['accentFg', 'accent', 4.5],
  ['accentFg', 'accentHover', 4.5],
  ['dangerFg', 'danger', 4.5],
  ['dangerFg', 'dangerHover', 4.5],
  ['primarySoftFg', 'primarySoft', 4.5],
  ['secondarySoftFg', 'secondarySoft', 4.5],
  ['accentSoftFg', 'accentSoft', 4.5],
  ['successSoftFg', 'successSoft', 4.5],
  ['warningSoftFg', 'warningSoft', 4.5],
  ['dangerSoftFg', 'dangerSoft', 4.5],
  ['infoSoftFg', 'infoSoft', 4.5],
  ['primary', 'bg', 4.5],
  ['primary', 'surface', 4.5],
  ['secondary', 'surface', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'bg', 4.5],
  ['borderInput', 'surface', 3],
  ['borderInput', 'bg', 3],
  ['focusRing', 'bg', 3],
  ['focusRing', 'surface', 3],
  ['success', 'surface', 3],
  ['info', 'surface', 3],
];

describe.each(['light', 'dark'] as ColorScheme[])('%s colour tokens', (scheme) => {
  it.each(PAIRS)('%s on %s meets %s:1', (fg, bg, min) => {
    expect(contrast(colors[scheme][fg], colors[scheme][bg])).toBeGreaterThanOrEqual(min);
  });

  it('defines the same token names as the light scheme', () => {
    expect(Object.keys(colors[scheme]).sort()).toEqual(Object.keys(colors.light).sort());
  });
});

it('keeps the brand colours from the specification in light mode', () => {
  expect(colors.light).toMatchObject({ primary: '#2563EB', secondary: '#0F766E', accent: '#F59E0B', bg: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A', textSubtle: '#64748B', success: '#16A34A', warning: '#F59E0B', danger: '#DC2626' });
  expect(colors.dark.bg).toBe('#0F172A');
});
