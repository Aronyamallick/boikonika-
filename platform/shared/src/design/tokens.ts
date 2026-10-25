/**
 * Boikonika design tokens — the single source of truth for colour, type, space,
 * radius, elevation and motion. Web turns these into CSS custom properties
 * (web/scripts/generate-tokens.mjs → Tailwind theme); mobile reads them directly.
 *
 * Colour semantics (do not use raw hex values in components):
 * - primary   (blue)  trust, knowledge, the main action on a screen
 * - secondary (teal)  learning, growth, positive/confirming actions
 * - accent    (gold)  achievements, highlights, offers — used sparingly
 */

export type ColorScheme = 'light' | 'dark';

export interface SemanticColors {
  bg: string;
  bgSubtle: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  /** Boundary of form controls — at least 3:1 against surfaces (WCAG 1.4.11). */
  borderInput: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  primary: string;
  primaryHover: string;
  primaryFg: string;
  primarySoft: string;
  primarySoftFg: string;
  secondary: string;
  secondaryHover: string;
  secondaryFg: string;
  secondarySoft: string;
  secondarySoftFg: string;
  accent: string;
  accentHover: string;
  accentFg: string;
  accentSoft: string;
  accentSoftFg: string;
  success: string;
  successSoft: string;
  successSoftFg: string;
  warning: string;
  warningSoft: string;
  warningSoftFg: string;
  danger: string;
  dangerHover: string;
  dangerFg: string;
  dangerSoft: string;
  dangerSoftFg: string;
  info: string;
  infoSoft: string;
  infoSoftFg: string;
  focusRing: string;
  overlay: string;
  skeleton: string;
  /** Single-series chart marks (validated against the chart surface for each scheme). */
  chart1: string;
}

export const colors: Record<ColorScheme, SemanticColors> = {
  light: {
    bg: '#F8FAFC',
    bgSubtle: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#F1F5F9',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    borderInput: '#7D8BA1',
    text: '#0F172A',
    textMuted: '#475569',
    textSubtle: '#64748B',
    textInverse: '#F8FAFC',
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primaryFg: '#FFFFFF',
    primarySoft: '#EFF6FF',
    primarySoftFg: '#1E40AF',
    secondary: '#0F766E',
    secondaryHover: '#115E59',
    secondaryFg: '#FFFFFF',
    secondarySoft: '#F0FDFA',
    secondarySoftFg: '#115E59',
    accent: '#F59E0B',
    accentHover: '#D97706',
    accentFg: '#1F1300',
    accentSoft: '#FFFBEB',
    accentSoftFg: '#92400E',
    success: '#16A34A',
    successSoft: '#F0FDF4',
    successSoftFg: '#166534',
    warning: '#F59E0B',
    warningSoft: '#FFFBEB',
    warningSoftFg: '#92400E',
    danger: '#DC2626',
    dangerHover: '#B91C1C',
    dangerFg: '#FFFFFF',
    dangerSoft: '#FEF2F2',
    dangerSoftFg: '#991B1B',
    info: '#0284C7',
    infoSoft: '#F0F9FF',
    infoSoftFg: '#075985',
    focusRing: '#2563EB',
    overlay: 'rgba(15, 23, 42, 0.55)',
    skeleton: '#E2E8F0',
    chart1: '#2563EB',
  },
  // Dedicated dark palette (not an inversion): lifted surfaces, softened text,
  // brand hues lightened just enough to keep WCAG AA contrast on #0F172A.
  dark: {
    bg: '#0F172A',
    bgSubtle: '#111C33',
    surface: '#16213A',
    surfaceRaised: '#1C2945',
    surfaceSunken: '#0B1222',
    border: '#26344F',
    borderStrong: '#334462',
    borderInput: '#667896',
    text: '#E2E8F0',
    textMuted: '#B4C0D3',
    textSubtle: '#8A99B2',
    textInverse: '#0F172A',
    // Lighter fills with dark text: white on a mid blue cannot reach 4.5:1 here.
    primary: '#60A5FA',
    primaryHover: '#93C5FD',
    primaryFg: '#0F172A',
    primarySoft: '#172554',
    primarySoftFg: '#BFDBFE',
    secondary: '#14B8A6',
    secondaryHover: '#2DD4BF',
    secondaryFg: '#042F2E',
    secondarySoft: '#0F2F2C',
    secondarySoftFg: '#99F6E4',
    accent: '#FBBF24',
    accentHover: '#FCD34D',
    accentFg: '#1F1300',
    accentSoft: '#3A2A0A',
    accentSoftFg: '#FDE68A',
    success: '#22C55E',
    successSoft: '#0E2A1B',
    successSoftFg: '#BBF7D0',
    warning: '#FBBF24',
    warningSoft: '#3A2A0A',
    warningSoftFg: '#FDE68A',
    danger: '#F87171',
    dangerHover: '#FCA5A5',
    dangerFg: '#0F172A',
    dangerSoft: '#3B1218',
    dangerSoftFg: '#FECACA',
    info: '#38BDF8',
    infoSoft: '#0C2A3D',
    infoSoftFg: '#BAE6FD',
    focusRing: '#60A5FA',
    overlay: 'rgba(2, 6, 23, 0.7)',
    skeleton: '#26344F',
    chart1: '#4A8DF7',
  },
};

export const typography = {
  fontFamily: {
    // Latin glyphs from Inter, Bangla glyphs from Noto Sans Bengali — both self-hosted.
    sans: "'Inter Variable', 'Noto Sans Bengali Variable', 'Noto Sans Bengali', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    serif: "'Noto Serif Bengali Variable', 'Noto Serif Bengali', Georgia, 'Times New Roman', serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  // Large, readable scale; Bangla script needs a taller line-height than Latin.
  fontSize: {
    xs: { size: 12, lineHeight: 18 },
    sm: { size: 14, lineHeight: 22 },
    base: { size: 16, lineHeight: 26 },
    lg: { size: 18, lineHeight: 28 },
    xl: { size: 20, lineHeight: 30 },
    '2xl': { size: 24, lineHeight: 34 },
    '3xl': { size: 30, lineHeight: 40 },
    '4xl': { size: 36, lineHeight: 46 },
    '5xl': { size: 48, lineHeight: 58 },
  },
  fontWeight: { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
} as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, '2xl': 28, full: 9999 } as const;

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80, 24: 96 } as const;

export const shadows: Record<ColorScheme, { sm: string; md: string; lg: string }> = {
  light: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
    md: '0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.05)',
    lg: '0 16px 40px -12px rgba(15, 23, 42, 0.18)',
  },
  dark: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    md: '0 6px 16px -4px rgba(0, 0, 0, 0.5)',
    lg: '0 20px 44px -12px rgba(0, 0, 0, 0.6)',
  },
};

// Restrained motion; every animation must be disabled under prefers-reduced-motion.
export const motion = {
  duration: { fast: 120, base: 200, slow: 320 },
  easing: { standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)', emphasized: 'cubic-bezier(0.3, 0, 0, 1)' },
} as const;

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const;

export const zIndex = { base: 0, dropdown: 30, sticky: 40, overlay: 50, modal: 60, toast: 70 } as const;

const kebab = (key: string) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** CSS custom properties for one colour scheme, e.g. `--bk-primary-soft: #EFF6FF`. */
export function cssVariables(scheme: ColorScheme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors[scheme])) vars[`--bk-${kebab(key)}`] = value;
  for (const [key, value] of Object.entries(shadows[scheme])) vars[`--bk-shadow-${key}`] = value;
  return vars;
}

export const colorTokenNames = Object.keys(colors.light).map(kebab);
