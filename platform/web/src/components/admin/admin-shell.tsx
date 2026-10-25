'use client';

import { Banknote, Copyright, FileLock2, Flag, GraduationCap, LayoutDashboard, Megaphone, PenLine, Receipt, RotateCcw, ScrollText, Settings2, ShieldCheck, Tags, TicketPercent, UserRound, UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/auth/auth-provider';
import { EmptyState } from '@/components/ui/states';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/** Staff navigation. Each module adds its entry with the permission that unlocks it. */
export const ADMIN_NAV = [
  { href: '/admin', key: 'adminOverview.nav', permission: 'analytics.view', Icon: LayoutDashboard },
  { href: '/admin/moderation', key: 'adminModeration.nav', permission: 'reports.view', Icon: Flag },
  { href: '/admin/users', key: 'adminUsers.nav', permission: 'users.view', Icon: UserRound },
  { href: '/admin/orders', key: 'adminOrders.nav', permission: 'orders.view', Icon: Receipt },
  { href: '/admin/refunds', key: 'adminRefunds.nav', permission: 'orders.refund', Icon: RotateCcw },
  { href: '/admin/payouts', key: 'adminPayouts.nav', permission: 'payouts.view', Icon: Banknote },
  { href: '/admin/coupons', key: 'adminCoupons.nav', permission: 'coupons.manage', Icon: TicketPercent },
  { href: '/admin/products', key: 'admin.navProducts', permission: 'products.view', Icon: Tags },
  { href: '/admin/kyc', key: 'admin.navVerification', permission: 'kyc.view', Icon: ShieldCheck },
  { href: '/admin/author-claims', key: 'adminClaims.nav', permission: 'authors.manage', Icon: PenLine },
  { href: '/admin/student', key: 'adminStudent.nav', permission: 'student.manage', Icon: GraduationCap },
  { href: '/admin/copyright', key: 'adminCopyright.nav', permission: 'copyright.manage', Icon: Copyright },
  { href: '/admin/digital', key: 'adminDigital.nav', permission: 'copyright.manage', Icon: FileLock2 },
  { href: '/admin/announcements', key: 'adminAnnouncements.nav', permission: 'notifications.broadcast', Icon: Megaphone },
  { href: '/admin/roles', key: 'admin.navRoles', permission: 'roles.view', Icon: UsersRound },
  { href: '/admin/audit', key: 'adminAudit.nav', permission: 'audit.view', Icon: ScrollText },
  { href: '/admin/settings', key: 'adminSettings.nav', permission: 'settings.manage', Icon: Settings2 },
] as const;

function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { can } = useAuth();
  const pathname = usePathname();
  const items = ADMIN_NAV.filter((item) => can(item.permission));
  if (!items.length) return <EmptyState title={t('admin.noAccess')} className="container-page my-10" />;
  // minmax(0, …) keeps the sideways-scrolling phone nav from widening the page.
  return (
    <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-8">
      <nav aria-label={t('admin.title')} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-fg-subtle">{t('admin.title')}</p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {items.map(({ href, key, Icon }) => {
            // The overview lives at /admin itself, which every other section starts with.
            const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
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
