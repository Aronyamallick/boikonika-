'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
const ORDER: Theme[] = ['light', 'dark', 'system'];
export const THEME_STORAGE_KEY = 'bk-theme';

/** Inline script (runs before paint) so the page never flashes the wrong theme. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

/** Saves and applies a theme choice (also used by the profile settings page). */
export function applyTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage unavailable (private mode): still apply for this page
  }
  apply(theme);
  window.dispatchEvent(new CustomEvent('bk-theme-change', { detail: theme }));
}

export function ThemeToggle() {
  const t = useTranslations('common');
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_STORAGE_KEY) as Theme | null) ?? 'system';
    setTheme(saved);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => (localStorage.getItem(THEME_STORAGE_KEY) ?? 'system') === 'system' && apply('system');
    media.addEventListener('change', onChange);
    const onExternal = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener('bk-theme-change', onExternal);
    return () => {
      media.removeEventListener('change', onChange);
      window.removeEventListener('bk-theme-change', onExternal);
    };
  }, []);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const label = { light: t('themeLight'), dark: t('themeDark'), system: t('themeSystem') };

  return (
    <button
      type="button"
      onClick={() => {
        localStorage.setItem(THEME_STORAGE_KEY, next);
        setTheme(next);
        apply(next);
      }}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg"
      aria-label={`${t('theme')}: ${label[theme]}`}
      title={`${t('theme')}: ${label[theme]}`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
