import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { clubBookSchema, clubEventSchema, clubInviteSchema, clubListQuerySchema, clubPostSchema, clubSchema, clubUpdateSchema, memberActionSchema, pollSchema, pollVoteSchema, scheduleItemSchema } from '@boikonika/shared';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { AppException } from '../../common/errors/app-exception';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { ClubsService } from './clubs.service';

const cover = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const membersQuery = z.object({ status: z.enum(['active', 'pending', 'invited']).default('active') });
const postsQuery = z.object({ page: z.coerce.number().int().min(1).max(500).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20) });
const pinBody = z.object({ pinned: z.boolean() });
type Me = AuthenticatedUser;

@ApiTags('clubs')
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Book clubs and study groups (search, type, purpose, subject, mine)' })
  async list(@ZodQuery(clubListQuerySchema) q: z.output<typeof clubListQuerySchema>, @CurrentUser() viewer?: Me) {
    const { items, meta } = await this.clubs.list(q, viewer?.id);
    return paginated(items, meta);
  }

  @Post()
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  async create(@CurrentUser() user: Me, @ZodBody(clubSchema) body: z.output<typeof clubSchema>) {
    return withMessage(await this.clubs.create(user.id, body), t('api.clubs.created'));
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string, @CurrentUser() viewer?: Me) {
    return this.clubs.detail(slug, viewer?.id);
  }

  @Patch(':slug')
  @ApiBearerAuth('access-token')
  async update(@CurrentUser() user: Me, @Param('slug') slug: string, @ZodBody(clubUpdateSchema) body: z.output<typeof clubUpdateSchema>) {
    return withMessage(await this.clubs.update(user.id, slug, body), t('api.clubs.updated'));
  }

  @Put(':slug/cover')
  @ApiBearerAuth('access-token')
  @UseInterceptors(cover)
  @ApiConsumes('multipart/form-data')
  setCover(@CurrentUser() user: Me, @Param('slug') slug: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw AppException.validation([{ field: 'file', code: 'required', message: 'validation.required' }]);
    return this.clubs.setCover(user.id, slug, file.buffer);
  }

  @Post(':slug/join')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  async join(@CurrentUser() user: Me, @Param('slug') slug: string) {
    const result = await this.clubs.join(user.id, slug);
    return withMessage(result, t(result.status === 'active' ? 'api.clubs.joined' : 'api.clubs.requested'));
  }

  @Delete(':slug/membership')
  @ApiBearerAuth('access-token')
  async leave(@CurrentUser() user: Me, @Param('slug') slug: string) {
    await this.clubs.leave(user.id, slug);
    return withMessage(null, t('api.clubs.left'));
  }

  @Public()
  @Get(':slug/members')
  members(@Param('slug') slug: string, @ZodQuery(membersQuery) q: z.output<typeof membersQuery>, @CurrentUser() viewer?: Me) {
    return this.clubs.members(slug, viewer?.id, q.status);
  }

  @Post(':slug/members/:userId')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  async memberAction(@CurrentUser() user: Me, @Param('slug') slug: string, @Param('userId', new ParseUUIDPipe()) userId: string, @ZodBody(memberActionSchema) body: z.output<typeof memberActionSchema>) {
    return withMessage(await this.clubs.memberAction(user.id, slug, userId, body.action), t(`api.clubs.member.${body.action}`));
  }

  @Post(':slug/invites')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  async invite(@CurrentUser() user: Me, @Param('slug') slug: string, @ZodBody(clubInviteSchema) body: z.output<typeof clubInviteSchema>) {
    return withMessage(await this.clubs.invite(user.id, slug, body.username), t('api.clubs.invited'));
  }

  @Public()
  @Get(':slug/posts')
  async posts(@Param('slug') slug: string, @ZodQuery(postsQuery) q: z.output<typeof postsQuery>, @CurrentUser() viewer?: Me) {
    const { items, meta } = await this.clubs.posts(slug, viewer?.id, q.page, q.pageSize);
    return paginated(items, meta);
  }

  @Post(':slug/posts')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  async createPost(@CurrentUser() user: Me, @Param('slug') slug: string, @ZodBody(clubPostSchema) body: z.output<typeof clubPostSchema>) {
    const result = await this.clubs.createPost(user.id, slug, body);
    return withMessage(result, t(result.status === 'published' ? 'api.clubs.posted' : 'api.community.held'));
  }

  @Delete(':slug/posts/:postId')
  @ApiBearerAuth('access-token')
  async deletePost(@CurrentUser() user: Me, @Param('slug') slug: string, @Param('postId', new ParseUUIDPipe()) postId: string) {
    await this.clubs.deletePost(user.id, slug, postId);
    return withMessage(null, t('api.community.deleted'));
  }

  @Put(':slug/posts/:postId/pin')
  @ApiBearerAuth('access-token')
  pin(@CurrentUser() user: Me, @Param('slug') slug: string, @Param('postId', new ParseUUIDPipe()) postId: string, @ZodBody(pinBody) body: z.output<typeof pinBody>) {
    return this.clubs.pin(user.id, slug, postId, body.pinned);
  }

  @Post(':slug/events')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  async createEvent(@CurrentUser() user: Me, @Param('slug') slug: string, @ZodBody(clubEventSchema) body: z.output<typeof clubEventSchema>) {
    return withMessage(await this.clubs.createEvent(user.id, slug, body), t('api.clubs.eventCreated'));
  }

  @Delete(':slug/events/:eventId')
  @ApiBearerAuth('access-token')
  async deleteEvent(@CurrentUser() user: Me, @Param('slug') slug: string, @Param('eventId', new ParseUUIDPipe()) eventId: string) {
    await this.clubs.deleteEvent(user.id, slug, eventId);
    return withMessage(null, t('api.clubs.eventDeleted'));
  }

  @Put(':slug/books')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Set the book for a month (current, upcoming or finished)' })
  async setBook(@CurrentUser() user: Me, @Param('slug') slug: string, @ZodBody(clubBookSchema) body: z.output<typeof clubBookSchema>) {
    return withMessage(await this.clubs.setBook(user.id, slug, body), t('api.clubs.bookSet'));
  }

  @Delete(':slug/books/:clubBookId')
  @ApiBearerAuth('access-token')
  async removeBook(@CurrentUser() user: Me, @Param('slug') slug: string, @Param('clubBookId', new ParseUUIDPipe()) clubBookId: string) {
    await this.clubs.removeBook(user.id, slug, clubBookId);
    return withMessage(null, t('api.clubs.bookRemoved'));
  }

  @Post(':slug/books/:clubBookId/schedule')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  async addSchedule(@CurrentUser() user: Me, @Param('slug') slug: string, @Param('clubBookId', new ParseUUIDPipe()) clubBookId: string, @ZodBody(scheduleItemSchema) body: z.output<typeof scheduleItemSchema>) {
    return withMessage(await this.clubs.addScheduleItem(user.id, slug, clubBookId, body), t('api.clubs.scheduleAdded'));
  }

  @Delete(':slug/schedule/:itemId')
  @ApiBearerAuth('access-token')
  async removeSchedule(@CurrentUser() user: Me, @Param('slug') slug: string, @Param('itemId', new ParseUUIDPipe()) itemId: string) {
    await this.clubs.removeScheduleItem(user.id, slug, itemId);
    return withMessage(null, t('api.clubs.scheduleRemoved'));
  }

  @Post(':slug/polls')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  async createPoll(@CurrentUser() user: Me, @Param('slug') slug: string, @ZodBody(pollSchema) body: z.output<typeof pollSchema>) {
    return withMessage(await this.clubs.createPoll(user.id, slug, body), t('api.clubs.pollCreated'));
  }

  @Post(':slug/polls/:pollId/vote')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  vote(@CurrentUser() user: Me, @Param('slug') slug: string, @Param('pollId', new ParseUUIDPipe()) pollId: string, @ZodBody(pollVoteSchema) body: z.output<typeof pollVoteSchema>) {
    return this.clubs.vote(user.id, slug, pollId, body.optionIds);
  }
}
