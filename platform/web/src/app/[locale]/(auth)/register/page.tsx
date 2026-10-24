import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Spinner } from '@/components/ui/spinner';
import { Link } from '@/i18n/navigation';
import { RegisterForm } from './register-form';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('registerTitle'), description: t('registerSubtitle'), robots: { index: false, follow: true } };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <AuthShell
      title={t('registerTitle')}
      subtitle={t('registerSubtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t('loginButton')}
          </Link>
        </>
      }
    >
      <Suspense fallback={<Spinner className="mx-auto h-6 w-6 text-primary" />}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
