import type { ReactNode } from 'react';

// The real root layout is app/[locale]/layout.tsx (it owns <html lang>); this one only passes through.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
