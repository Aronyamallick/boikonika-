import { Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { bookListQuerySchema, productListQuerySchema } from '@boikonika/shared';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { AppException } from '../../common/errors/app-exception';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { CatalogService } from './catalog.service';
import { HomeService } from './home.service';
import { RecommendationsService } from './recommendations.service';
import { SearchService } from './search.service';
import { SitemapService } from './sitemap.service';

const searchQuery = z.object({ q: z.string().max(200).default('') });
const recommendationQuery = z.object({ limit: z.coerce.number().int().min(1).max(48).default(24) });
const authorQuery = z.object({ q: z.string().trim().max(120).optional(), page: z.coerce.number().int().min(1).max(200).default(1), pageSize: z.coerce.number().int().min(1).max(60).default(24) });

@ApiTags('catalogue')
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly search: SearchService,
    private readonly recommendations: RecommendationsService,
    private readonly home: HomeService,
    private readonly sitemap: SitemapService,
  ) {}

  @Public()
  @Get('sitemap')
  @ApiOperation({ summary: 'Public pages for the website sitemap (path and last change; private content left out)' })
  sitemapEntries() {
    return this.sitemap.entries();
  }

  @Public()
  @Get('home')
  @ApiOperation({ summary: 'Homepage sections configured in the CMS, with their books, authors and stores' })
  homepage() {
    return this.home.sections();
  }

  @Public()
  @Get('books')
  @ApiOperation({ summary: 'Browse and filter books (category, genre, author, publisher, language, condition, price, rating, picks)' })
  async books(@ZodQuery(bookListQuerySchema) q: z.output<typeof bookListQuerySchema>) {
    const { items, meta } = await this.catalog.listBooks(q);
    return paginated(items, meta);
  }

  @Public()
  @Get('books/:slug')
  @ApiOperation({ summary: 'Book page: editions, every seller’s offer, contributors, ratings and related books' })
  book(@Param('slug') slug: string) {
    return this.catalog.bookDetail(slug);
  }

  @Public()
  @Get('products')
  @ApiOperation({ summary: 'Browse general products (stationery, bags, electronics…)' })
  async products(@ZodQuery(productListQuerySchema) q: z.output<typeof productListQuerySchema>) {
    const { items, meta } = await this.catalog.listProducts(q);
    return paginated(items, meta);
  }

  @Public()
  @Get('products/:slug')
  @ApiOperation({ summary: 'Product page with variants and stock (book listings redirect to their book page)' })
  product(@Param('slug') slug: string) {
    return this.catalog.productDetail(slug);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Category tree (optionally only book or general product categories)' })
  categories(@Query('for') appliesTo?: string) {
    return this.catalog.categoryTree(appliesTo === 'book' || appliesTo === 'general' ? appliesTo : undefined);
  }

  @Public()
  @Get('categories/{*path}')
  @ApiOperation({ summary: 'One category with its children and breadcrumbs (path like books/academic/hsc)' })
  category(@Param('path') path: string | string[]) {
    return this.catalog.category(Array.isArray(path) ? path.join('/') : path);
  }

  @Public()
  @Get('genres')
  genres() {
    return this.catalog.genreList();
  }

  @Public()
  @Get('authors')
  @ApiOperation({ summary: 'Authors (search by name in Bangla or English)' })
  authors(@ZodQuery(authorQuery) q: z.output<typeof authorQuery>) {
    return this.catalog.authorList(q.q, q.page, q.pageSize);
  }

  @Public()
  @Get('authors/:slug')
  @ApiOperation({ summary: 'Author page with books' })
  author(@Param('slug') slug: string, @CurrentUser() viewer?: AuthenticatedUser) {
    return this.catalog.author(slug, viewer?.id);
  }

  @Get('authors/:slug/follow')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Whether I follow this author' })
  followState(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    return this.catalog.followState(user.id, slug);
  }

  @Post('authors/:slug/follow')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  followAuthor(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    return this.catalog.followAuthor(user.id, slug, true);
  }

  @Delete('authors/:slug/follow')
  @ApiBearerAuth('access-token')
  unfollowAuthor(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    return this.catalog.followAuthor(user.id, slug, false);
  }

  @Public()
  @Get('publishers/:slug')
  @ApiOperation({ summary: 'Publisher page with books' })
  publisher(@Param('slug') slug: string) {
    return this.catalog.publisher(slug);
  }

  @Public()
  @Get('stores/:slug')
  @ApiOperation({ summary: 'Seller store page with books and products' })
  store(@Param('slug') slug: string) {
    return this.catalog.store(slug);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search books, authors and products (Bangla/English, typos, ISBN)' })
  searchAll(@ZodQuery(searchQuery) q: { q: string }, @CurrentUser() viewer?: AuthenticatedUser) {
    if (viewer) void this.recommendations.rememberSearch(viewer.id, q.q);
    return this.search.search(q.q);
  }

  @Public()
  @Get('books/:slug/also-liked')
  @ApiOperation({ summary: 'Books readers of this one also have (aggregated; only readers who share their reading)' })
  async alsoLiked(@Param('slug') slug: string) {
    const [book] = await this.catalog.bookIdBySlug(slug);
    if (!book) throw AppException.notFound('Book');
    return this.recommendations.alsoLiked(book.id);
  }

  @Get('me/recommendations')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Personal picks with a reason for each, plus "because you read …" (popular books when personalisation is off)' })
  forYou(@CurrentUser() user: AuthenticatedUser, @ZodQuery(recommendationQuery) q: { limit: number }) {
    return this.recommendations.forUser(user.id, q.limit);
  }

  @Get('me/search-history')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'My recent searches (kept 90 days, only with personalisation on)' })
  searchHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.recommendations.searchHistory(user.id);
  }

  @Post('me/search-history')
  @HttpCode(204)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remember a search I made (ignored when personalisation is off)' })
  async rememberSearch(@CurrentUser() user: AuthenticatedUser, @ZodBody(searchQuery) body: { q: string }) {
    await this.recommendations.rememberSearch(user.id, body.q);
  }

  @Delete('me/search-history')
  @ApiBearerAuth('access-token')
  async clearSearchHistory(@CurrentUser() user: AuthenticatedUser) {
    await this.recommendations.clearSearchHistory(user.id);
    return withMessage(null, t('api.catalog.searchHistoryCleared'));
  }

  @Public()
  @Get('search/suggest')
  @ApiOperation({ summary: 'Autocomplete suggestions (popular searches when the query is empty)' })
  suggest(@ZodQuery(searchQuery) q: { q: string }) {
    return this.search.suggest(q.q);
  }
}
