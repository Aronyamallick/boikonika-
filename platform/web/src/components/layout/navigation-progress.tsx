'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

/**
 * A thin bar at the top while the next page loads after a link is followed. It replaces a route-level
 * loading screen, which would make Next.js send the page's status before it is known (so a missing book
 * would answer 200 instead of 404).
 */
function Progress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a || a.getAttribute('target') === '_blank' || a.hasAttribute('download')) return;
      const url = new URL((a as HTMLAnchorElement).href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      // Only slow navigations show the bar; quick ones finish before it appears.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState('loading'), 150);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setState((s) => (s === 'loading' ? 'done' : 'idle'));
    const reset = setTimeout(() => setState('idle'), 300);
    return () => clearTimeout(reset);
  }, [pathname, search]);

  if (state === 'idle') return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-0.5">
      <div className={`h-full bg-primary transition-[width,opacity] duration-300 motion-reduce:transition-none ${state === 'loading' ? 'w-4/5 opacity-100' : 'w-full opacity-0'}`} />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Progress />
    </Suspense>
  );
}
