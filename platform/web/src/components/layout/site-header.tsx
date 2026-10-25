import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import { UserMenu } from '../auth/user-menu';
import { CartButton } from '../cart/cart-button';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';
import { SearchBox } from './search-box';
import { ThemeToggle } from './theme-toggle';

export async function SiteHeader() {
  const t = await getTranslations();
  const links = [
    { href: '/books', label: t('nav.books') },
    { href: '/community', label: t('nav.community') },
    { href: '/student-zone', label: t('nav.studentZone') },
    { href: '/clubs', label: t('nav.bookClubs') },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="container-page flex h-16 items-center gap-3 lg:gap-6">
        <Link href="/" className="shrink-0 rounded-lg" aria-label={t('common.appName')}>
          <Logo name={t('common.appName')} />
        </Link>
        <div className="hidden flex-1 md:block">
          <SearchBox action="/search" />
        </div>
        <nav aria-label={t('nav.explore')} className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-fg-muted hover:bg-subtle hover:text-fg">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Suspense fallback={null}>
            <LocaleSwitcher />
          </Suspense>
          <ThemeToggle />
          <CartButton />
          <UserMenu />
        </div>
      </div>
      <div className="container-page pb-3 md:hidden">
        <SearchBox action="/search" />
      </div>
    </header>
  );
}
