import { BRAND, messages } from '@boikonika/shared';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { IntlProvider } from 'use-intl';
import { ThemeProvider } from '@/lib/theme';

/** Renders with the app's theme and the shared Bangla (or English) messages (async, as RNTL 14 renders are). */
export function renderWithApp(ui: ReactElement, locale: 'bn' | 'en' = 'bn') {
  return render(
    <ThemeProvider>
      <IntlProvider locale={locale} messages={messages[locale]} timeZone={BRAND.timezone}>
        {ui}
      </IntlProvider>
    </ThemeProvider>,
  );
}
