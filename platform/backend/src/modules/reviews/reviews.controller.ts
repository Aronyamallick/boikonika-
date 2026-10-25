import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { reviewListQuerySchema, reviewReplySchema, reviewSchema, reviewUpdateSchema, reviewVoteSchema } from '@boikonika/shared';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { ReviewsService } from './reviews.service';

const eligibilityQuery = z.object({ bookId: z.uuid().optional(), productId: z.uuid().optional() }).refine((v) => !!v.bookId !== !!v.productId);

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('books/:slug/reviews')
  @ApiOperation({ summary: 'Published reviews of a book (most helpful first by default)' })
  async bookReviews(@Param('slug') slug: string, @ZodQuery(reviewListQuerySchema) q: z.output<typeof reviewListQuerySchema>, @CurrentUser() viewer?: AuthenticatedUser) {
    const { items, meta } = await this.reviews.list({ bookSlug: slug }, q, viewer?.id);
    return paginated(items, meta);
  }

  @Public()
  @Get('products/:slug/reviews')
  async productReviews(@Param('slug') slug: string, @ZodQuery(reviewListQuerySchema) q: z.output<typeof reviewListQuerySchema>, @CurrentUser() viewer?: AuthenticatedUser) {
    const { items, meta } = await this.reviews.list({ productSlug: slug }, q, viewer?.id);
    return paginated(items, meta);
  }

  @Get('reviews/eligibility')
  @ApiBearerAuth('access-token')
  eligibility(@CurrentUser() user: AuthenticatedUser, @ZodQuery(eligibilityQuery) q: z.output<typeof eligibilityQuery>) {
    return this.reviews.eligibility(user.id, q);
  }

  @Post('reviews')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  async create(@CurrentUser() user: AuthenticatedUser, @ZodBody(reviewSchema) body: z.output<typeof reviewSchema>) {
    const result = await this.reviews.create(user.id, body);
    return withMessage(result, t(result.status === 'published' ? 'api.reviews.published' : 'api.reviews.held'));
  }

  @Patch('reviews/:id')
  @ApiBearerAuth('access-token')
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(reviewUpdateSchema) body: z.output<typeof reviewUpdateSchema>) {
    const result = await this.reviews.update(user.id, id, body);
    return withMessage(result, t(result.status === 'published' ? 'api.reviews.updated' : 'api.reviews.held'));
  }

  @Delete('reviews/:id')
  @ApiBearerAuth('access-token')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.reviews.remove(user.id, id);
    return withMessage(null, t('api.reviews.deleted'));
  }

  @Post('reviews/:id/vote')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  vote(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(reviewVoteSchema) body: { helpful: boolean }) {
    return this.reviews.vote(user.id, id, body.helpful);
  }

  @Post('reviews/:id/reply')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Seller’s public answer to a review of their sale' })
  async reply(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(reviewReplySchema) body: { body: string }) {
    return withMessage(await this.reviews.reply(user.id, id, body.body), t('api.reviews.replied'));
  }

  @Get('me/reviews')
  @ApiBearerAuth('access-token')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.reviews.mine(user.id);
  }
}
