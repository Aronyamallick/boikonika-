'use client';

import { ExternalLink } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { RequirePermission } from '@/components/admin/admin-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { Tabs } from '@/components/ui/tabs';
import { Link } from '@/i18n/navigation';
import { BannersTab } from './banners-tab';
import { SectionsTab } from './sections-tab';
import { TestimonialsTab } from './testimonials-tab';

export default function AdminHomepagePage() {
  return (
    <RequirePermission permission="homepage.manage">
      <Suspense>
        <HomepageDesk />
      </Suspense>
    </RequirePermission>
  );
}

function HomepageDesk() {
  const t = useTranslations('adminHomepage');
  const { can } = useAuth();
  const tab = useSearchParams().get('tab');
  const tabs = [
    { key: 'sections', label: t('tabSections'), content: <SectionsTab /> },
    ...(can('banners.manage') ? [{ key: 'banners', label: t('tabBanners'), content: <BannersTab /> }] : []),
    { key: 'testimonials', label: t('tabTestimonials'), content: <TestimonialsTab /> },
  ];
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="mb-4 mt-1 text-fg-muted">{t('text')}</p>
        </div>
        <Link href="/" target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {t('viewHomepage')}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <Tabs defaultIndex={Math.max(0, tabs.findIndex((x) => x.key === tab))} tabs={tabs} />
    </>
  );
}
