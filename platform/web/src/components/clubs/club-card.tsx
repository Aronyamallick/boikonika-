import { BookOpen, GraduationCap, Lock, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import type { ClubCard as Club } from '@/lib/clubs';

/** Club summary: cover band, name, kind, members and the book being read. */
export function ClubCard({ club }: { club: Club }) {
  const t = useTranslations();
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div
        className="h-20 bg-gradient-to-r from-secondary-soft via-primary-soft to-accent-soft"
        style={club.coverUrl ? { backgroundImage: `url(${club.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        aria-hidden="true"
      />
      <div className="flex flex-1 flex-col p-4">
        <h2 className="font-bold leading-snug text-fg">
          <Link href={`/clubs/${club.slug}`} className="hover:text-primary">
            {club.name}
          </Link>
        </h2>
        <p className="mt-1 flex flex-wrap gap-1.5">
          {club.purpose === 'study' ? (
            <Badge tone="secondary">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              {club.subject ? t(`subjects.${club.subject}`) : t('clubs.studyGroup')}
            </Badge>
          ) : null}
          <Badge tone="neutral">
            {club.type === 'private' ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {t(`clubs.types.${club.type}`)}
          </Badge>
          {club.membership?.status === 'active' ? <Badge tone="primary">{t(`clubs.roles.${club.membership.role}`)}</Badge> : club.membership?.status === 'pending' ? <Badge tone="warning">{t('clubs.requestSent')}</Badge> : null}
        </p>
        {club.institutionName ? <p className="mt-1 text-xs text-fg-muted">{club.institutionName}</p> : null}
        {club.description ? <p className="mt-2 line-clamp-2 flex-1 text-sm text-fg-muted">{club.description}</p> : <span className="flex-1" />}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {t('clubs.members', { count: club.memberCount })}
          </span>
          {club.currentBook ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{t('clubs.reading', { title: club.currentBook.title })}</span>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
