'use client';

import { useEffect } from 'react';
import { apiRequest } from '@/lib/api/client';

/** Counts a read from the reader's own browser (server-rendered pages can't tell readers apart). */
export function ViewBeacon({ articleId }: { articleId: string }) {
  useEffect(() => {
    apiRequest(`/articles/${articleId}/view`, { method: 'POST' }).catch(() => undefined);
  }, [articleId]);
  return null;
}
