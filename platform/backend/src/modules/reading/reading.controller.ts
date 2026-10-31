import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { libraryQuerySchema, libraryShelfSchema, progressSchema, readingGoalsSchema, readingSessionSchema, statsQuerySchema } from '@boikonika/shared';
import type { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { pageQuery } from '../../common/util/pagination';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { GamificationService } from '../gamification/gamification.service';
import { ChallengesService } from './challenges.service';
import { ReadingService } from './reading.service';

@ApiTags('reading')
@ApiBearerAuth('access-token')
@Controller('me')
export class ReadingController {
  constructor(
    private readonly reading: ReadingService,
    private readonly gamification: GamificationService,
  ) {}

  @Get('library')
  @ApiOperation({ summary: 'My Library: books on each shelf with reading progress' })
  library(@CurrentUser() user: AuthenticatedUser, @ZodQuery(libraryQuerySchema) q: z.output<typeof libraryQuerySchema>) {
    return this.reading.library(user.id, q);
  }

  @Get('library/:bookId')
  shelf(@CurrentUser() user: AuthenticatedUser, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return this.reading.shelfOf(user.id, bookId);
  }

  @Put('library/:bookId')
  async setShelf(@CurrentUser() user: AuthenticatedUser, @Param('bookId', new ParseUUIDPipe()) bookId: string, @ZodBody(libraryShelfSchema) body: z.output<typeof libraryShelfSchema>) {
    return withMessage(await this.reading.setShelf(user.id, bookId, body.shelf), t('api.reading.shelved'));
  }

  @Delete('library/:bookId')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    await this.reading.remove(user.id, bookId);
    return withMessage(null, t('api.reading.removed'));
  }

  @Get('reading/history')
  @ApiOperation({ summary: 'My reading history: books started and finished, e-books downloaded' })
  async history(@CurrentUser() user: AuthenticatedUser, @ZodQuery(pageQuery) q: z.output<typeof pageQuery>) {
    const { items, meta } = await this.reading.history(user.id, q.page, q.pageSize);
    return paginated(items, meta);
  }

  @Put('reading/:bookId/progress')
  @ApiOperation({ summary: 'Set my position in a book (finishing it completes it)' })
  progress(@CurrentUser() user: AuthenticatedUser, @Param('bookId', new ParseUUIDPipe()) bookId: string, @ZodBody(progressSchema) body: z.output<typeof progressSchema>) {
    return this.reading.setProgress(user.id, bookId, body);
  }

  @Post('reading/sessions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Log reading time (timer or manual); updates streak, goals, challenges and XP' })
  async session(@CurrentUser() user: AuthenticatedUser, @ZodBody(readingSessionSchema) body: z.output<typeof readingSessionSchema>) {
    return withMessage(await this.reading.logSession(user.id, body), t('api.reading.logged'));
  }

  @Delete('reading/sessions/:id')
  async deleteSession(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.reading.deleteSession(user.id, id);
    return withMessage(null, t('api.reading.sessionDeleted'));
  }

  @Get('reading/stats')
  stats(@CurrentUser() user: AuthenticatedUser, @ZodQuery(statsQuerySchema) q: z.output<typeof statsQuerySchema>) {
    return this.reading.stats(user.id, q.days);
  }

  @Get('reading/goals')
  goals(@CurrentUser() user: AuthenticatedUser) {
    return this.reading.goals(user.id);
  }

  @Put('reading/goals')
  async setGoals(@CurrentUser() user: AuthenticatedUser, @ZodBody(readingGoalsSchema) body: z.output<typeof readingGoalsSchema>) {
    return withMessage(await this.reading.setGoals(user.id, body), t('api.reading.goalsSaved'));
  }

  @Get('achievements')
  @ApiOperation({ summary: 'Level, XP and every badge with my progress towards it' })
  async achievements(@CurrentUser() user: AuthenticatedUser) {
    const [summary, badges] = await Promise.all([this.gamification.summary(user.id), this.gamification.badgeProgress(user.id)]);
    return { ...summary, badges };
  }
}

@ApiTags('reading')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Public()
  @Get()
  list(@CurrentUser() viewer?: AuthenticatedUser) {
    return this.challenges.list(viewer?.id);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string, @CurrentUser() viewer?: AuthenticatedUser) {
    return this.challenges.detail(slug, viewer?.id);
  }

  @Post(':slug/join')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  async join(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    return withMessage(await this.challenges.join(user.id, slug), t('api.reading.challengeJoinedOk'));
  }

  @Delete(':slug/join')
  @ApiBearerAuth('access-token')
  async leave(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    await this.challenges.leave(user.id, slug);
    return withMessage(null, t('api.reading.challengeLeft'));
  }
}
