import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { copyrightClaimSchema, copyrightDecisionSchema, copyrightQuerySchema, counterNoticeSchema, reportDecisionSchema, reportQueueQuerySchema, takedownSchema } from '@boikonika/shared';
import { z } from 'zod';
import { requestContext } from '../../common/context/request-context';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { pageQuery } from '../../common/util/pagination';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { CopyrightService } from './copyright.service';
import { ModerationAdminService } from './moderation-admin.service';

type Me = AuthenticatedUser;
const TARGET_TYPES = ['post', 'comment', 'review', 'product', 'book', 'user', 'club', 'club_post', 'store'];
const HELD_TYPES = ['post', 'comment', 'club_post'];
const heldQuery = pageQuery.extend({ type: z.enum(['post', 'comment', 'club_post']).default('post') });
const targetType = new ParseEnumPipe(TARGET_TYPES);

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin/moderation')
export class AdminModerationController {
  constructor(private readonly moderation: ModerationAdminService) {}

  @Get('queue')
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Open reports grouped by what they are about (urgent first, then oldest)' })
  async queue(@ZodQuery(reportQueueQuerySchema) q: z.output<typeof reportQueueQuerySchema>) {
    const { items, meta } = await this.moderation.queue(q);
    return paginated(items, meta);
  }

  @Post('targets/:type/:id/review')
  @HttpCode(200)
  @RequirePermissions('reports.resolve')
  review(@CurrentUser() user: Me, @Param('type', targetType) type: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.moderation.startReview(user.id, type, id);
  }

  @Post('targets/:type/:id/decision')
  @HttpCode(200)
  @RequirePermissions('reports.resolve')
  @ApiOperation({ summary: 'Decide all open reports about a target: warning, removal, restriction, suspension, ban or no action' })
  async decide(@CurrentUser() user: Me, @Param('type', targetType) type: string, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(reportDecisionSchema) body: z.output<typeof reportDecisionSchema>) {
    return withMessage(await this.moderation.decide(user.id, type, id, body), t('api.moderation.decided'));
  }

  @Post('actions/:id/revert')
  @HttpCode(200)
  @RequirePermissions('reports.resolve')
  async revert(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(takedownSchema) body: { reason: string }) {
    return withMessage(await this.moderation.revert(user.id, id, body.reason), t('api.moderation.reverted'));
  }

  @Get('held')
  @RequirePermissions('community.moderate')
  @ApiOperation({ summary: 'Posts, comments and club posts waiting for review' })
  async held(@ZodQuery(heldQuery) q: z.output<typeof heldQuery>) {
    const { items, meta } = await this.moderation.held(q.type, q.page, q.pageSize);
    return paginated(items, meta);
  }

  @Post('held/:type/:id/approve')
  @HttpCode(200)
  @RequirePermissions('community.moderate')
  async approve(@CurrentUser() user: Me, @Param('type', new ParseEnumPipe(HELD_TYPES)) type: 'post' | 'comment' | 'club_post', @Param('id', new ParseUUIDPipe()) id: string) {
    return withMessage(await this.moderation.approveHeld(user.id, type, id), t('api.moderation.approved'));
  }

  @Post('held/:type/:id/remove')
  @HttpCode(200)
  @RequirePermissions('community.moderate')
  async remove(@CurrentUser() user: Me, @Param('type', new ParseEnumPipe(HELD_TYPES)) type: string, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(takedownSchema) body: { reason: string }) {
    return withMessage(await this.moderation.decide(user.id, type, id, { action: 'content_removal', reason: body.reason, scope: 'all' }), t('api.moderation.decided'));
  }
}

@ApiTags('copyright')
@Controller()
export class CopyrightController {
  constructor(
    private readonly copyright: CopyrightService,
    private readonly moderation: ModerationAdminService,
  ) {}

  @Public()
  @Post('copyright/claims')
  @HttpCode(201)
  @ApiOperation({ summary: 'Send a copyright complaint about content on this site (rights holders or their agents)' })
  async submit(@CurrentUser() user: Me | undefined, @ZodBody(copyrightClaimSchema) body: z.output<typeof copyrightClaimSchema>) {
    const ctx = requestContext.get();
    return withMessage(await this.copyright.submit(body, { userId: user?.id, ip: ctx?.ip ?? undefined, locale: ctx?.locale === 'en' ? 'en' : 'bn' }), t('api.copyright.received'));
  }

  @Get('me/standing')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'My account standing: moderation decisions, active restrictions and copyright complaints about my content' })
  async standing(@CurrentUser() user: Me) {
    const [history, claims] = await Promise.all([this.moderation.historyFor(user.id, false), this.copyright.mine(user.id)]);
    return { ...history, copyright: claims };
  }

  @Post('me/copyright-claims/:id/counter')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Answer a takedown with a counter-notice' })
  async counter(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(counterNoticeSchema) body: z.output<typeof counterNoticeSchema>) {
    return withMessage(await this.copyright.counter(user.id, id, body), t('api.copyright.counterReceived'));
  }

  @Get('admin/copyright')
  @ApiBearerAuth('access-token')
  @RequirePermissions('copyright.manage')
  async list(@ZodQuery(copyrightQuerySchema) q: z.output<typeof copyrightQuerySchema>) {
    const { items, meta } = await this.copyright.list(q);
    return paginated(items, meta);
  }

  @Post('admin/copyright/:id/decision')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @RequirePermissions('copyright.manage')
  async decide(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(copyrightDecisionSchema) body: z.output<typeof copyrightDecisionSchema>) {
    return withMessage(await this.copyright.decide(user.id, id, body), t('api.copyright.decided'));
  }
}
