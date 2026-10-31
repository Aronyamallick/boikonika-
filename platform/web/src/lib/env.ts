/** Public runtime configuration (inlined at build time by Next.js). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
/** Server-side calls can use a private network address (e.g. http://backend:4000 inside Docker). */
export const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? API_URL).replace(/\/$/, '');
