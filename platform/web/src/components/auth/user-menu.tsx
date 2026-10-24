'use client';

import { LayoutDashboard, LibraryBig, LogOut, Package, Shield, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { buttonClasses } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from './auth-provider';

/** Header account control: "Log in" for visitors, an accessible account menu for signed-in users. */
export function UserMenu() {
  const t = useTranslations();
  const { status, user, signOut, can } = useAuth();
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
    { href: '/orders', label: t('nav.orders'), Icon: Package },
    { href: '/account/security', label: t('account.security'), Icon: Shield },
    ...(can('analytics.view') || can('users.view') ? [{ href: '/admin', label: t('nav.adminDashboard'), Icon: LayoutDashboard }] : []),
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
        aria-label={t('account.menu')}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={user.displayName} src={user.avatarUrl ?? undefined} size="sm" />
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
