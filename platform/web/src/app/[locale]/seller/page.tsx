import { redirect } from '@/i18n/navigation';

export default async function SellerHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/seller/products', locale });
}
