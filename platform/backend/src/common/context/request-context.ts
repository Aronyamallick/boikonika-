import { AsyncLocalStorage } from 'node:async_hooks';
import { DEFAULT_LOCALE, type Locale } from '@boikonika/shared';

export interface RequestContext {
  requestId: string;
  locale: Locale;
  ip: string | null;
  userAgent: string | null;
  userId?: string;
  sessionId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Per-request values (request id, locale, client IP) available anywhere without passing them around. */
export const requestContext = {
  run<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  locale(): Locale {
    return storage.getStore()?.locale ?? DEFAULT_LOCALE;
  },
  setUser(userId: string, sessionId?: string): void {
    const ctx = storage.getStore();
    if (ctx) {
      ctx.userId = userId;
      ctx.sessionId = sessionId;
    }
  },
};
