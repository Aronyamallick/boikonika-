import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SITE_URL } from './config';

/** Website paths the app has its own screen for (the app's routes mirror the site's). */
const APP_PATHS = [
  /^\/$/,
  /^\/(books|clubs|community|library|search|cart|checkout|notifications|student-zone|help|explore|login|register)$/,
  /^\/books\/[^/]+$/,
  /^\/categories\/.+$/,
  /^\/posts\/[^/]+$/,
  /^\/clubs\/[^/]+$/,
  /^\/pages\/[^/]+$/,
  /^\/help\/[^/]+$/,
  /^\/account\/(orders|addresses)$/,
  /^\/account\/orders\/[^/]+$/,
];

/** The app path for a website link (absolute or relative), or null when only the website has it. */
export function appPath(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, SITE_URL);
  } catch {
    return null;
  }
  if (url.origin !== new URL(SITE_URL).origin && !href.startsWith('/')) return null;
  // English pages live under /en on the website; the app keeps the language as a setting instead.
  const path = url.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  return APP_PATHS.some((re) => re.test(path)) ? `${path}${url.search}` : null;
}

/** Opens a link from the API (notifications, banners, Markdown) in the app, or in the browser. */
export async function openLink(href: string): Promise<void> {
  const path = appPath(href);
  if (path) {
    router.push(path as Href);
    return;
  }
  const absolute = /^https?:\/\//.test(href) ? href : `${SITE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
  if (/^mailto:/.test(href)) {
    const { Linking } = await import('react-native');
    await Linking.openURL(href);
    return;
  }
  await WebBrowser.openBrowserAsync(absolute);
}
