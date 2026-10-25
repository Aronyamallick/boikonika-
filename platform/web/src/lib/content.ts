import type { ArticleKind } from '@boikonika/shared';
import type { LocalizedText } from '@/lib/catalog';

export interface ArticleCard {
  id: string;
  slug: string;
  kind: ArticleKind;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  language: string;
  audience: string;
  tags: string[];
  readMinutes: number;
  author: { name: string; username: string | null; avatarUrl: string | null } | null;
  publishedAt: string | null;
}

export interface ArticleDetail extends ArticleCard {
  body: string;
  viewCount: number;
  updatedAt: string;
  related: ArticleCard[];
}

export interface CmsPage {
  slug: string;
  title: LocalizedText;
  body: LocalizedText;
  seoDescription: string | null;
  updatedAt: string;
}

export interface Faq {
  id: string;
  category: string;
  question: LocalizedText;
  answer: LocalizedText;
}

export interface Banner {
  id: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  ctaLabel: LocalizedText;
  link: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
}

export interface Testimonial {
  id: string;
  name: string;
  role: LocalizedText;
  quote: LocalizedText;
  avatarUrl: string | null;
}

/** Where an article lives on the site: help articles in the help centre, everything else on the blog. */
export const articleHref = (a: Pick<ArticleCard, 'kind' | 'slug'>) => (a.kind === 'help' ? `/help/${a.slug}` : `/blog/${a.slug}`);

/** Policy pages linked together at the foot of each one. */
export const POLICY_PAGES = ['terms', 'privacy', 'return-policy', 'shipping-policy', 'seller-policy', 'copyright-policy', 'community-guidelines', 'cookie-policy'] as const;
