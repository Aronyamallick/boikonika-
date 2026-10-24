import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LogoMark } from './logo';

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();
  const columns = [
    { title: t('footer.shop'), links: [['/books', t('nav.books')], ['/marketplace', t('nav.marketplace')], ['/categories', t('nav.categories')], ['/sell', t('nav.sell')]] },
    { title: t('footer.learn'), links: [['/student-zone', t('nav.studentZone')], ['/clubs', t('nav.bookClubs')], ['/challenges', t('nav.challenges')], ['/blog', t('nav.blog')]] },
    { title: t('footer.company'), links: [['/pages/about', t('nav.about')], ['/authors', t('nav.authors')], ['/publishers', t('nav.publishers')], ['/pages/contact', t('nav.contact')]] },
    { title: t('footer.support'), links: [['/help', t('nav.help')], ['/pages/terms', t('nav.terms')], ['/pages/privacy', t('nav.privacy')]] },
  ];
  return (
    <footer className="mt-16 border-t border-line bg-surface pb-24 md:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-lg font-extrabold">{t('common.appName')}</span>
          </div>
          <p className="max-w-xs text-sm text-fg-muted">{t('footer.about')}</p>
          <p className="text-sm font-medium text-secondary">{t('common.philosophy')}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-3 text-sm font-bold text-fg">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href!} className="text-sm text-fg-muted hover:text-primary">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-fg-subtle sm:flex-row sm:justify-between">
          <p>{t('footer.rights', { year })}</p>
          <p>{t('common.developedBy')}</p>
        </div>
      </div>
    </footer>
  );
}
