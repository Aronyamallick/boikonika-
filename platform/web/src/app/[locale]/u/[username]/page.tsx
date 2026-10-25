import { BadgeCheck, CalendarDays, GraduationCap, Link2, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { PostFeed } from '@/components/community/post-feed';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { serverApi } from '@/lib/api/server';
import type { PublicProfile } from '@/lib/types';
import { ProfileActions } from './profile-actions';

type Params = Promise<{ locale: string; username: string }>;

async function load(locale: string, username: string) {
  if (!/^[A-Za-z0-9._]{3,30}$/.test(username)) return null;
  return serverApi<PublicProfile>(`/users/${encodeURIComponent(username)}`, { locale, revalidate: 60 });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, username } = await params;
  const profile = await load(locale, username);
  if (!profile) return { title: '404', robots: { index: false } };
  const title = `${profile.displayName} (@${profile.username})`;
  return {
    title,
    description: profile.bio ?? undefined,
    alternates: { canonical: `${locale === 'bn' ? '' : '/en'}/u/${profile.username}` },
    // Only fully public profiles are indexed.
    robots: { index: profile.visibility.profile, follow: profile.visibility.profile },
    openGraph: { type: 'profile', title, description: profile.bio ?? undefined, images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : undefined },
  };
}

export default async function ProfilePage({ params }: { params: Params }) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  const profile = await load(locale, username);
  if (!profile) notFound();
  const t = await getTranslations();
  const format = await getFormatter();
  const verifiedRoles = profile.roles.filter((r) => r !== 'student' || profile.roles.length === 1);

  return (
    <div className="pb-10">
      <div className="h-36 bg-gradient-to-r from-primary-soft via-secondary-soft to-accent-soft sm:h-48" style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
      <div className="container-page">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 sm:-mt-14">
          <Avatar name={profile.displayName} src={profile.avatarUrl} size="xl" className="ring-4 ring-canvas" />
          <ProfileActions username={profile.username} />
        </div>
        <div className="mt-4 max-w-2xl">
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{profile.displayName}</h1>
          <p className="text-fg-muted">@{profile.username}</p>
          {verifiedRoles.length ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={t('common.verified')}>
              {verifiedRoles.map((role) => (
                <li key={role}>
                  <Badge tone="primary">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {t(`roles.${role}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
          {profile.visibility.profile ? (
            <>
              {profile.bio ? <p className="mt-4 whitespace-pre-line leading-relaxed text-fg">{profile.bio}</p> : null}
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-muted">
                {profile.location ? (
                  <li className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {profile.location}
                  </li>
                ) : null}
                {profile.institution ? (
                  <li className="inline-flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4" aria-hidden="true" />
                    {profile.institution}
                  </li>
                ) : null}
                {profile.website ? (
                  <li className="inline-flex items-center gap-1.5">
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                    <a href={profile.website} rel="nofollow ugc noopener" target="_blank" className="text-primary hover:underline">
                      {profile.website.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                ) : null}
                <li className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {t('profile.joined', { date: format.dateTime(new Date(profile.joinedAt), { year: 'numeric', month: 'long' }) })}
                </li>
              </ul>
            </>
          ) : (
            <p className="mt-4 rounded-lg bg-subtle px-4 py-3 text-sm text-fg-muted">{t('profile.followersOnly', { name: profile.displayName })}</p>
          )}
          <p className="mt-4 flex gap-5 text-sm">
            <span>
              <strong className="text-fg">{format.number(profile.followerCount)}</strong> <span className="text-fg-muted">{t('profile.followersTitle')}</span>
            </span>
            <span>
              <strong className="text-fg">{format.number(profile.followingCount)}</strong> <span className="text-fg-muted">{t('profile.followingTitle')}</span>
            </span>
          </p>
        </div>
        {profile.visibility.profile ? (
          <section aria-labelledby="profile-posts" className="mt-8 max-w-2xl">
            <h2 id="profile-posts" className="mb-4 text-xl font-bold text-fg">
              {t('community.posts')}
            </h2>
            <PostFeed endpoint={`/users/${encodeURIComponent(profile.username)}/posts`} label={t('community.posts')} empty={t('community.noPostsYet', { name: profile.displayName })} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
