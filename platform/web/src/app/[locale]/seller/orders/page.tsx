import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SELLER_ORDER_TABS } from '@/lib/commerce';
import { SellerOrdersList } from './seller-orders-list';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('sellerOrders.title') };
}

export default async function SellerOrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  return <SellerOrdersList initialStatus={SELLER_ORDER_TABS.find((s) => s && s === status)} />;
}
