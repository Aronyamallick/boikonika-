import { translate, type Locale } from '@boikonika/shared';
import { requestContext } from './context/request-context';

/** Translates an API message key (e.g. "api.auth.otpInvalid") into the caller's language. */
export function t(key: string, params?: Record<string, string | number>, locale?: Locale): string {
  return translate(locale ?? requestContext.locale(), key, params);
}
