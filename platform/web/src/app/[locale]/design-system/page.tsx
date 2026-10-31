import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { colorTokenNames, typography } from '@boikonika/shared';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/ui/book-cover';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Price } from '@/components/ui/price';
import { Rating } from '@/components/ui/rating';
import { BookCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { InteractiveDemos } from './demos';

export const metadata: Metadata = { title: 'Design system', robots: { index: false, follow: false } };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-line pt-8">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Internal living style guide — every token and component in both themes (QA reference). */
export default async function DesignSystemPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const labels = {
    openDialog: t('common.details'),
    toastSuccess: t('common.saved'),
    toastError: t('common.errorTitle'),
    saved: t('common.saved'),
    error: t('errors.generic'),
    dialogTitle: t('common.confirm'),
    dialogText: t('auth.suspiciousLogin', { device: 'Chrome · Dhaka' }),
    close: t('common.close'),
    cancel: t('common.cancel'),
    confirm: t('common.confirm'),
    email: t('auth.email'),
    emailHint: t('auth.loginSubtitle'),
    phone: t('auth.phone'),
    phoneError: t('validation.phone'),
    language: t('common.language'),
    bio: t('common.details'),
    terms: t('auth.acceptTerms'),
    tab1: t('book.description'),
    tab1Text: t('landing.heroSubtitle'),
    tab2: t('book.reviews'),
    tab2Text: t('landing.challengeText'),
  };

  return (
    <div className="container-page space-y-10 py-10">
      <header>
        <h1 className="text-3xl font-extrabold">Design system</h1>
        <p className="mt-1 text-fg-muted">{t('common.philosophy')}</p>
      </header>

      <Section title="Color tokens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {colorTokenNames.map((name) => (
            <li key={name} className="overflow-hidden rounded-lg border border-line bg-surface text-xs">
              <span className="block h-12" style={{ background: `var(--bk-${name})` }} />
              <span className="block px-2 py-1.5 font-mono text-fg-muted">{name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Typography">
        <div className="space-y-2">
          {(Object.entries(typography.fontSize) as Array<[string, { size: number; lineHeight: number }]>).reverse().map(([key, v]) => (
            <p key={key} style={{ fontSize: v.size, lineHeight: `${v.lineHeight}px` }}>
              <span className="mr-3 font-mono text-xs text-fg-subtle">{key}</span>
              {t('landing.heroTitle')} — Find your next book
            </p>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t('book.addToCart')}</Button>
          <Button variant="secondary">{t('common.continue')}</Button>
          <Button variant="accent">{t('common.getStarted')}</Button>
          <Button variant="outline">{t('common.cancel')}</Button>
          <Button variant="ghost">{t('common.back')}</Button>
          <Button variant="danger">{t('common.delete')}</Button>
          <Button variant="link">{t('common.learnMore')}</Button>
          <Button loading>{t('common.saving')}</Button>
          <Button disabled>{t('common.save')}</Button>
          <Button size="sm">{t('common.follow')}</Button>
          <Button size="lg">{t('book.buyNow')}</Button>
        </div>
      </Section>

      <Section title="Badges, ratings, prices, avatars">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{t('common.new')}</Badge>
          <Badge tone="primary">{t('book.formats.paperback')}</Badge>
          <Badge tone="secondary">{t('roles.student')}</Badge>
          <Badge tone="accent">{t('landing.bestSellers')}</Badge>
          <Badge tone="success">{t('status.order.delivered')}</Badge>
          <Badge tone="warning">{t('status.kyc.under_review')}</Badge>
          <Badge tone="danger">{t('status.payment.failed')}</Badge>
          <Badge tone="info">{t('common.verified')}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Rating value={4.5} label={t('book.rating', { rating: 4.5 })} size="md" />
          <Price amount="320.00" compareAt="400.00" locale={locale} size="lg" />
          <Avatar name="Rabindranath Tagore" />
          <Avatar name="জীবনানন্দ দাশ" size="lg" />
        </div>
      </Section>

      <Section title="Alerts">
        <div className="grid gap-3 md:grid-cols-2">
          <Alert tone="info" title={t('common.details')}>{t('landing.why1Text')}</Alert>
          <Alert tone="success" title={t('common.saved')}>{t('auth.emailVerified')}</Alert>
          <Alert tone="warning" title={t('status.kyc.resubmission_required')}>{t('landing.why4Text')}</Alert>
          <Alert tone="danger" title={t('common.errorTitle')}>{t('errors.generic')}</Alert>
        </div>
      </Section>

      <Section title="Cards & book covers">
        <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>{t('book.details')}</CardTitle>
            </CardHeader>
            <CardBody className="text-sm text-fg-muted">{t('landing.heroSubtitle')}</CardBody>
            <CardFooter>
              <Button variant="ghost" size="sm">{t('common.cancel')}</Button>
              <Button size="sm">{t('common.save')}</Button>
            </CardFooter>
          </Card>
          <div className="grid grid-cols-3 gap-4">
            <BookCover title="পথের পাঁচালী" author="বিভূতিভূষণ বন্দ্যোপাধ্যায়" />
            <BookCover title="The Art of Learning" author="Josh Waitzkin" />
            <BookCardSkeleton />
          </div>
        </div>
      </Section>

      <Section title="States">
        <div className="grid gap-5 md:grid-cols-2">
          <EmptyState title={t('common.empty')} text={t('common.allCaughtUpText')} />
          <ErrorState title={t('common.offlineTitle')} text={t('common.offlineText')} offline />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </Section>

      <Section title="Forms, tabs, dialog, toast">
        <InteractiveDemos labels={labels} />
      </Section>
    </div>
  );
}
