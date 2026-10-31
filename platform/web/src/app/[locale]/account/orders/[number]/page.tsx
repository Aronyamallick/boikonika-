import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequireAuth } from '@/components/auth/require-auth';
import { OrderView } from './order-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; number: string }> }): Promise<Metadata> {
  const { locale, number } = await params;
  const t = await getTranslations({ locale });
  return { title: t('orders.number', { number }), robots: { index: false, follow: false } };
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ locale: string; number: string }>; searchParams: Promise<{ payment?: string; placed?: string }> }) {
  const { locale, number } = await params;
  setRequestLocale(locale);
  if (!/^BK\d{6}[2-9A-Z]{6}$/.test(number)) notFound();
  const { payment, placed } = await searchParams;
  return (
    <RequireAuth>
      <OrderView number={number} paymentOutcome={payment === 'success' || payment === 'failed' || payment === 'cancelled' ? payment : null} placed={placed === '1'} />
    </RequireAuth>
  );
}
