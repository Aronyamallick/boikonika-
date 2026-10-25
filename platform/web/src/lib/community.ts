/** Community response shapes (mirrors the API). */
export interface PostView {
  id: string;
  type: string;
  title: string | null;
  body: string;
  quoteSource: string | null;
  readingPercent: number | null;
  visibility: 'public' | 'followers' | 'private';
  studentZone: boolean;
  subject: string | null;
  status: string;
  book: { id: string; slug: string; title: string; coverUrl: string | null; authors: string[] } | null;
  media: Array<{ url: string; alt: string | null; width: number | null; height: number | null }>;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  liked: boolean;
  bookmarked: boolean;
  mine: boolean;
  author: { id: string; username: string; name: string; avatarUrl: string | null; isAuthor: boolean };
  createdAt: string;
  editedAt: string | null;
}

export interface CommentView {
  id: string;
  parentId: string | null;
  body: string | null;
  deleted: boolean;
  pending: boolean;
  likeCount: number;
  replyCount: number;
  liked: boolean;
  mine: boolean;
  canDelete: boolean;
  author: { id: string; username: string; name: string; avatarUrl: string | null };
  createdAt: string;
  editedAt: string | null;
  replies?: CommentView[];
}

export interface BookTag {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  authors: string[];
}
