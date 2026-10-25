import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequireAuth } from '@/components/auth/require-auth';
import { SandboxPayment } from './sandbox-payment';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('sandboxPay.title'), robots: { index: false, follow: false } };
}

/** Development-only simulator for the "sandbox" payment method (the API refuses it in production). */
export default async function SandboxPaymentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return (
    <RequireAuth>
      <SandboxPayment id={id} />
    </RequireAuth>
  );
}
