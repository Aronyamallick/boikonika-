import { SearchX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <div className="mb-5 rounded-full bg-primary-soft p-4 text-primary-soft-fg" aria-hidden="true">
        <SearchX className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-extrabold">{t('notFoundTitle')}</h1>
      <p className="mt-2 max-w-md text-fg-muted">{t('notFoundText')}</p>
      <Link href="/" className={buttonClasses({ className: 'mt-8' })}>
        {t('goHome')}
      </Link>
    </div>
  );
}
