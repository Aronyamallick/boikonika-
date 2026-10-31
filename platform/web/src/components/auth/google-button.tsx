'use client';

import type { AuthResult, TwoFactorChallenge } from '@boikonika/shared';
import { useLocale } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import { deviceId } from '@/lib/device';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: 'popup'; use_fedcm_for_prompt?: boolean }): void;
          renderButton(element: HTMLElement, options: Record<string, unknown>): void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * "Continue with Google" using Google Identity Services. Renders nothing unless
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured (see docs/integrations.md).
 */
export function GoogleButton({ onResult, onError }: { onResult: (result: AuthResult | TwoFactorChallenge) => void; onError: (error: unknown) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    const init = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        ux_mode: 'popup',
        use_fedcm_for_prompt: true,
        callback: ({ credential }) => {
          api<AuthResult | TwoFactorChallenge>('/auth/google', { method: 'POST', body: { idToken: credential, deviceId: deviceId(), client: 'web', rememberDevice: true } })
            .then(onResult)
            .catch(onError);
        },
      });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: ref.current.offsetWidth || 320, locale });
      setReady(true);
    };
    if (window.google) return init();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [locale, onError, onResult]);

  if (!CLIENT_ID) return null;
  return <div ref={ref} className="flex min-h-11 justify-center" aria-busy={!ready} />;
}
