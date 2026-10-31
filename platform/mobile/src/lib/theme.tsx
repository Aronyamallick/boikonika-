import { colors, type ColorScheme, type SemanticColors } from '@boikonika/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { prefs } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';
interface ThemeValue {
  scheme: ColorScheme;
  c: SemanticColors;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}
const KEY = 'bk.theme';
const ThemeContext = createContext<ThemeValue | null>(null);

/** Light and dark use their own designed palettes from the shared tokens (dark is not an inversion). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');
  useEffect(() => {
    prefs.get<ThemePreference>(KEY).then((p) => p && setPref(p));
  }, []);
  const setPreference = useCallback((p: ThemePreference) => (setPref(p), prefs.set(KEY, p)), []);
  const scheme: ColorScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return <ThemeContext.Provider value={{ scheme, c: colors[scheme], preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
