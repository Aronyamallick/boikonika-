'use client';

import { ShieldCheck, UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/auth/auth-provider';
import { EmptyState } from '@/components/ui/states';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/** Staff navigation. Each module adds its entry with the permission that unlocks it. */
export const ADMIN_NAV = [
  { href: '/admin/kyc', key: 'navVerification', permission: 'kyc.view', Icon: ShieldCheck },
  { href: '/admin/roles', key: 'navRoles', permission: 'roles.view', Icon: UsersRound },
] as const;

function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const { can } = useAuth();
  const pathname = usePathname();
  const items = ADMIN_NAV.filter((item) => can(item.permission));
  if (!items.length) return <EmptyState title={t('noAccess')} className="container-page my-10" />;
  return (
    <div className="container-page grid gap-6 py-6 lg:grid-cols-[220px_1fr] lg:py-8">
      <nav aria-label={t('title')} className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-fg-subtle">{t('title')}</p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {items.map(({ href, key, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold', active ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:bg-subtle hover:text-fg')}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}

/** Renders children only for users with the permission (the API enforces it as well). */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const t = useTranslations('admin');
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <EmptyState title={t('noAccess')} />;
}
