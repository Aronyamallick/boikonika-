/** Book club response shapes (mirror the API). */
export interface ClubCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: 'public' | 'private' | 'school' | 'college' | 'university';
  purpose: 'reading' | 'study';
  subject: string | null;
  institutionName: string | null;
  joinPolicy: 'open' | 'request' | 'invite';
  coverUrl: string | null;
  memberCount: number;
  currentBook: { title: string; slug: string; coverUrl: string | null } | null;
  membership: { role: 'owner' | 'moderator' | 'member'; status: 'active' | 'pending' | 'invited' | 'banned' | 'left' } | null;
}

export interface ClubPoll {
  id: string;
  question: string;
  allowMultiple: boolean;
  closesAt: string | null;
  open: boolean;
  totalVotes: number;
  options: Array<{ id: string; label: string; votes: number; mine: boolean }>;
}

export interface ClubDetail extends ClubCard {
  rules: string | null;
  createdAt: string;
  owner: { username: string; name: string; avatarUrl: string | null } | null;
  readable: boolean;
  canModerate: boolean;
  isOwner: boolean;
  pendingCount: number;
  books: Array<{
    id: string;
    month: string;
    status: 'current' | 'upcoming' | 'finished';
    book: { id: string; slug: string; title: string; coverUrl: string | null; authors: string[] };
    schedule: Array<{ id: string; title: string; fromPage: number | null; toPage: number | null; dueOn: string }>;
  }>;
  events: Array<{ id: string; title: string; description: string | null; startsAt: string; endsAt: string | null; location: string | null; onlineUrl: string | null }>;
  polls: ClubPoll[];
}

export interface ClubPost {
  id: string;
  parentId: string | null;
  title: string | null;
  body: string;
  kind: 'discussion' | 'announcement';
  pinned: boolean;
  pending: boolean;
  replyCount: number;
  mine: boolean;
  canDelete: boolean;
  author: { username: string; name: string; avatarUrl: string | null };
  createdAt: string;
  replies?: ClubPost[];
}

export interface ClubMember {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  role: 'owner' | 'moderator' | 'member';
  status: string;
  joinedAt: string;
}
