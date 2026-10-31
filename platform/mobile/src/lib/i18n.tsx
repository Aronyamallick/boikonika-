import { BRAND, DEFAULT_LOCALE, isLocale, messages, type Locale } from '@boikonika/shared';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { IntlProvider } from 'use-intl';
import { setApiLocale } from './api';
import { prefs } from './storage';

const KEY = 'bk.locale';
const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void } | null>(null);

/** Bangla unless the phone is set to English; the reader's own choice is remembered. */
function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    prefs.get<string>(KEY).then((saved) => {
      if (isLocale(saved)) setLocaleState(saved);
      setReady(true);
    });
  }, []);
  useEffect(() => {
    setApiLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setApiLocale(next);
    prefs.set(KEY, next);
  }, []);

  if (!ready) return null;
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {/* Same messages as the website; a missing key shows its name instead of crashing. */}
      <IntlProvider locale={locale} messages={messages[locale]} timeZone={BRAND.timezone} onError={() => undefined}>
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleSetting() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocaleSetting outside LocaleProvider');
  return ctx;
}
