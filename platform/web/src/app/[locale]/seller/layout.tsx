import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SellerLayout({ children }: { children: ReactNode }) {
  return <SellerShell>{children}</SellerShell>;
}
