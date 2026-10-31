export type { ArticleCard, ArticleDetail, CmsPage, Faq, Banner, Testimonial } from '@boikonika/shared';
import type { ArticleCard } from '@boikonika/shared';

/** Where an article lives on the site: help articles in the help centre, everything else on the blog. */
export const articleHref = (a: Pick<ArticleCard, 'kind' | 'slug'>) => (a.kind === 'help' ? `/help/${a.slug}` : `/blog/${a.slug}`);

/** Policy pages linked together at the foot of each one. */
export const POLICY_PAGES = ['terms', 'privacy', 'return-policy', 'shipping-policy', 'seller-policy', 'copyright-policy', 'community-guidelines', 'cookie-policy'] as const;
