'use client';

import { useEffect } from 'react';
import { ADMIN_NAV } from '@/components/admin/admin-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from '@/i18n/navigation';
import { AdminOverview } from './overview';

/** /admin shows the overview to staff who may see analytics, and otherwise opens their first section. */
export default function AdminIndex() {
  const { can } = useAuth();
  const router = useRouter();
  const overview = can('analytics.view');
  useEffect(() => {
    if (overview) return;
    const first = ADMIN_NAV.find((item) => item.href !== '/admin' && can(item.permission));
    if (first) router.replace(first.href);
  }, [can, router, overview]);
  return overview ? <AdminOverview /> : null;
}
