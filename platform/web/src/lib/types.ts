/** API response shapes used by several pages (the API is the source of truth). */
export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  roles: string[];
  bio: string | null;
  education: string | null;
  institution: string | null;
  location: string | null;
  website: string | null;
  followerCount: number;
  followingCount: number;
  joinedAt: string;
  visibility: { profile: boolean; readingStats: boolean; library: boolean; activity: boolean };
  viewer: { self: boolean; following: boolean; blocked: boolean; signedIn: boolean };
}
