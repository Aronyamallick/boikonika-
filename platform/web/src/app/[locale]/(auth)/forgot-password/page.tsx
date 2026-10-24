import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { Link } from '@/i18n/navigation';
import { ForgotPasswordForm } from './forgot-form';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('resetTitle'), robots: { index: false, follow: true } };
}

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <AuthShell
      title={t('resetTitle')}
      subtitle={t('resetSubtitle')}
      footer={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t('backToLogin')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
