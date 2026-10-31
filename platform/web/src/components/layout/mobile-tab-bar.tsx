'use client';

import { BookMarked, Compass, Home, LogIn, User, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth/auth-provider';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/', key: 'home', Icon: Home },
  { href: '/explore', key: 'explore', Icon: Compass },
  { href: '/community', key: 'community', Icon: Users },
  { href: '/library', key: 'library', Icon: BookMarked },
] as const;

/** Five-item bottom navigation for phones (Home, Explore, Community, Library, Profile). */
export function MobileTabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { status, user } = useAuth();
  // The last tab is the profile when signed in and the way to log in otherwise.
  const account =
    status === 'authenticated' && user
      ? { href: `/u/${user.username}`, key: 'profile' as const, Icon: User }
      : { href: '/login', key: 'login' as const, Icon: LogIn };
  const tabs = [...TABS, account];
  return (
    <nav aria-label={t('home')} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map(({ href, key, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', active ? 'text-primary' : 'text-fg-subtle hover:text-fg')}
              >
                <Icon className="h-5.5 w-5.5" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
