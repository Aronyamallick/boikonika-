'use client';

import { BadgeCheck, Bell, Building2, LayoutDashboard, LibraryBig, LogOut, MapPin, Package, PenLine, Settings, Shield, ShieldCheck, Store, Tablet, User, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from './auth-provider';

/** Permissions that unlock at least one page of the staff area. */
const STAFF_PERMISSIONS = ['cms.manage', 'homepage.manage', 'banners.manage', 'support.manage', 'analytics.view', 'reports.view', 'audit.view', 'settings.manage', 'community.moderate', 'kyc.view', 'roles.view', 'users.view', 'products.view', 'orders.view', 'orders.refund', 'payouts.view', 'coupons.manage', 'authors.manage', 'student.manage', 'copyright.manage', 'notifications.broadcast'];

/** Header account control: "Log in" for visitors, an accessible account menu for signed-in users. */
export function UserMenu() {
  const t = useTranslations();
  const { status, user, signOut, can, hasRole } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    menuRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (status === 'loading') return <span className="ml-1 inline-block h-9 w-16 animate-pulse rounded-lg bg-skeleton" aria-hidden="true" />;
  if (status !== 'authenticated' || !user) {
    return (
      <Link href="/login" className={buttonClasses({ variant: 'primary', size: 'sm', className: 'ml-1' })}>
        {t('nav.login')}
      </Link>
    );
  }

  const items = [
    { href: `/u/${user.username}`, label: t('nav.profile'), Icon: User },
    { href: '/library', label: t('nav.library'), Icon: LibraryBig },
    { href: '/account/orders', label: t('nav.orders'), Icon: Package },
    { href: '/account/addresses', label: t('addresses.title'), Icon: MapPin },
    ...(hasRole('book_seller', 'general_seller', 'publisher', 'author') ? [{ href: '/seller', label: t('nav.sellerDashboard'), Icon: Store }] : []),
    ...(hasRole('author') ? [{ href: '/author', label: t('authorDashboard.title'), Icon: PenLine }] : []),
    ...(hasRole('publisher') ? [{ href: '/publisher', label: t('publisherDashboard.title'), Icon: Building2 }] : []),
    ...(hasRole('author') || hasRole('publisher') ? [{ href: '/studio/digital', label: t('studio.title'), Icon: Tablet }] : []),
    { href: '/account/profile', label: t('profileSettings.title'), Icon: Settings },
    { href: '/account/security', label: t('account.security'), Icon: Shield },
    { href: '/account/notifications', label: t('notifications.settingsTitle'), Icon: Bell },
    { href: '/account/verification', label: t('verification.title'), Icon: BadgeCheck },
    { href: '/account/standing', label: t('standing.title'), Icon: ShieldCheck },
    ...(STAFF_PERMISSIONS.some((p) => can(p)) ? [{ href: '/admin', label: t('nav.adminDashboard'), Icon: LayoutDashboard }] : []),
  ];

  return (
    <div className="relative ml-1">
      <button
        ref={buttonRef}
        type="button"
        className="flex items-center gap-2 rounded-full p-0.5 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${t('account.menu')}: ${user.displayName}`}
        onClick={() => setOpen((o) => !o)}
      >
        {/* Photo, or a person icon: initials here would be visible text that isn't the button's name. */}
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatars are user uploads with arbitrary sizes
          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg" aria-hidden="true">
            <UserRound className="h-5 w-5" />
          </span>
        )}
      </button>
      {open ? (
        <div ref={menuRef} id={menuId} role="menu" className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-line bg-surface-raised py-1 shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <p className="text-xs text-fg-subtle">{t('account.signedInAs')}</p>
            <p className="truncate font-semibold text-fg">{user.displayName}</p>
            <p className="truncate text-sm text-fg-muted">@{user.username}</p>
          </div>
          {items.map(({ href, label, Icon }) => (
            <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-fg hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none">
              <Icon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
              {label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left text-sm text-fg hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none"
            onClick={async () => {
              setOpen(false);
              await signOut();
              router.replace('/');
            }}
          >
            <LogOut className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
            {t('nav.logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
