'use client';

import { useFormatter, useNow } from 'next-intl';

/**
 * "5 minutes ago" that keeps itself current. The server and the browser render it at slightly
 * different moments, so a text difference on hydration is expected and allowed.
 */
export function RelativeTime({ date, className }: { date: string; className?: string }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const value = new Date(date);
  return (
    <time dateTime={date} title={format.dateTime(value, { dateStyle: 'medium', timeStyle: 'short' })} className={className} suppressHydrationWarning>
      {format.relativeTime(value, now)}
    </time>
  );
}
