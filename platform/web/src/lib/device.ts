const KEY = 'bk-device-id';

/** Random per-browser id so the API can tell "new device" sign-ins apart (no fingerprinting). */
export function deviceId(): string | undefined {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
