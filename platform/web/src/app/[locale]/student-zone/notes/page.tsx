import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequireAuth } from '@/components/auth/require-auth';
import { NotesView } from './notes-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'student' });
  return { title: t('myNotes'), robots: { index: false, follow: false } };
}

export default async function NotesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <div className="container-page py-6 lg:py-8">
        <NotesView />
      </div>
    </RequireAuth>
  );
}
