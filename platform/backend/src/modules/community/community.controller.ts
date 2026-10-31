import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { commentSchema, commentUpdateSchema, cursorQuerySchema, feedQuerySchema, MAX_POST_IMAGES, postSchema, postUpdateSchema } from '@boikonika/shared';
import { memoryStorage } from 'multer';
import type { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { AppException } from '../../common/errors/app-exception';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { ZodBody, ZodQuery, zodIssuesToDetails } from '../../common/validation/zod';
import { EngagementService } from './engagement.service';
import { PostsService } from './posts.service';

const imagesUpload = FilesInterceptor('images', MAX_POST_IMAGES, { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: MAX_POST_IMAGES, fields: 3 } });
type CursorQuery = z.output<typeof cursorQuerySchema>;
/** Cursor pages go out as `data` + `meta.nextCursor`. */
const cursorPage = <T>(page: { items: T[]; nextCursor: string | null }) => paginated(page.items, { nextCursor: page.nextCursor });

@ApiTags('community')
@Controller()
export class CommunityController {
  constructor(
    private readonly posts: PostsService,
    private readonly engagement: EngagementService,
  ) {}

  @Public()
  @Get('feed')
  @ApiOperation({ summary: 'Community feed: for you (ranked), following, latest; optional Student Zone / type / subject filters' })
  async feed(@ZodQuery(feedQuerySchema) q: z.output<typeof feedQuerySchema>, @CurrentUser() viewer?: AuthenticatedUser) {
    return cursorPage(await this.posts.feed(q, viewer?.id));
  }

  @Post('posts')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  @UseInterceptors(imagesUpload)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Publish a post (JSON in `data`, up to 4 `images`)' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body('data') raw: string | undefined, @UploadedFiles() files: Express.Multer.File[] = []) {
    let json: unknown;
    try {
      json = JSON.parse(raw ?? '');
    } catch {
      throw AppException.validation([{ field: 'data', code: 'invalid_json', message: 'errors.badJson' }]);
    }
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) throw AppException.validation(zodIssuesToDetails(parsed.error));
    const post = await this.posts.create(user.id, parsed.data, files.map((f) => f.buffer));
    return withMessage(post, t(post.status === 'published' ? 'api.community.published' : 'api.community.held'));
  }

  @Public()
  @Get('community/books')
  @ApiOperation({ summary: 'Find a book to tag in a post' })
  findBooks(@Query('q') q = '') {
    return this.posts.findBooks(String(q));
  }

  @Public()
  @Get('posts/:id')
  get(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() viewer?: AuthenticatedUser) {
    return this.posts.get(id, viewer?.id);
  }

  @Patch('posts/:id')
  @ApiBearerAuth('access-token')
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(postUpdateSchema) body: z.output<typeof postUpdateSchema>) {
    const post = await this.posts.update(user.id, id, body);
    return withMessage(post, t(post.status === 'published' ? 'api.community.updated' : 'api.community.held'));
  }

  @Delete('posts/:id')
  @ApiBearerAuth('access-token')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.posts.remove(user.id, id);
    return withMessage(null, t('api.community.deleted'));
  }

  @Put('posts/:id/like')
  @ApiBearerAuth('access-token')
  like(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.engagement.likePost(user.id, id, true);
  }

  @Delete('posts/:id/like')
  @ApiBearerAuth('access-token')
  unlike(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.engagement.likePost(user.id, id, false);
  }

  @Put('posts/:id/bookmark')
  @ApiBearerAuth('access-token')
  save(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.engagement.bookmarkPost(user.id, id, true);
  }

  @Delete('posts/:id/bookmark')
  @ApiBearerAuth('access-token')
  unsave(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.engagement.bookmarkPost(user.id, id, false);
  }

  @Public()
  @Get('posts/:id/comments')
  async comments(@Param('id', new ParseUUIDPipe()) id: string, @ZodQuery(cursorQuerySchema) q: CursorQuery, @CurrentUser() viewer?: AuthenticatedUser) {
    return cursorPage(await this.engagement.listComments(id, q.cursor, q.limit, viewer?.id));
  }

  @Post('posts/:id/comments')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  async comment(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(commentSchema) body: z.output<typeof commentSchema>) {
    const result = await this.engagement.addComment(user.id, id, body);
    return withMessage(result, t(result.status === 'published' ? 'api.community.commented' : 'api.community.commentHeld'));
  }

  @Patch('comments/:id')
  @ApiBearerAuth('access-token')
  editComment(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(commentUpdateSchema) body: z.output<typeof commentUpdateSchema>) {
    return this.engagement.editComment(user.id, id, body.body);
  }

  @Delete('comments/:id')
  @ApiBearerAuth('access-token')
  async deleteComment(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.engagement.deleteComment(user.id, id);
    return withMessage(null, t('api.community.commentDeleted'));
  }

  @Put('comments/:id/like')
  @ApiBearerAuth('access-token')
  likeComment(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.engagement.likeComment(user.id, id, true);
  }

  @Delete('comments/:id/like')
  @ApiBearerAuth('access-token')
  unlikeComment(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.engagement.likeComment(user.id, id, false);
  }

  @Public()
  @Get('users/:username/posts')
  async userPosts(@Param('username') username: string, @ZodQuery(cursorQuerySchema) q: CursorQuery, @CurrentUser() viewer?: AuthenticatedUser) {
    return cursorPage(await this.posts.byUser(username, q.cursor, q.limit, viewer?.id));
  }

  @Public()
  @Get('books/:slug/posts')
  async bookPosts(@Param('slug') slug: string, @ZodQuery(cursorQuerySchema) q: CursorQuery, @CurrentUser() viewer?: AuthenticatedUser) {
    return cursorPage(await this.posts.byBook(slug, q.cursor, q.limit, viewer?.id));
  }

  @Get('me/bookmarks')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Posts I saved' })
  async bookmarks(@CurrentUser() user: AuthenticatedUser, @ZodQuery(cursorQuerySchema) q: CursorQuery) {
    return cursorPage(await this.posts.bookmarked(user.id, q.cursor, q.limit));
  }
}
