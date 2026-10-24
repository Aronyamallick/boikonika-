'use client';

import { useEffect } from 'react';
import { ADMIN_NAV } from '@/components/admin/admin-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from '@/i18n/navigation';

/** /admin opens the first section the staff member can use. */
export default function AdminIndex() {
  const { can } = useAuth();
  const router = useRouter();
  useEffect(() => {
    const first = ADMIN_NAV.find((item) => can(item.permission));
    if (first) router.replace(first.href);
  }, [can, router]);
  return null;
}
