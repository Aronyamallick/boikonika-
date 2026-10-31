import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { broadcastSchema, notificationListQuerySchema, notificationPreferencesSchema, pushSubscriptionSchema, pushUnsubscribeSchema } from '@boikonika/shared';
import type { z } from 'zod';
import { requestContext } from '../../common/context/request-context';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { PushService } from '../../infra/messaging/push.service';
import { InboxService } from './inbox.service';

type Me = AuthenticatedUser;

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller()
export class NotificationsController {
  constructor(
    private readonly inbox: InboxService,
    private readonly push: PushService,
  ) {}

  @Get('me/notifications')
  @ApiOperation({ summary: 'My notifications, newest first (cursor pages; `unread=1` for unread only)' })
  async list(@CurrentUser() user: Me, @ZodQuery(notificationListQuerySchema) q: z.output<typeof notificationListQuerySchema>) {
    const { items, nextCursor } = await this.inbox.list(user.id, q);
    return paginated(items, { nextCursor });
  }

  @Get('me/notifications/unread-count')
  unread(@CurrentUser() user: Me) {
    return this.inbox.unreadCount(user.id);
  }

  @Post('me/notifications/read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: Me) {
    return this.inbox.markAllRead(user.id);
  }

  @Post('me/notifications/:id/read')
  @HttpCode(200)
  read(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.inbox.markRead(user.id, id);
  }

  @Delete('me/notifications/:id')
  remove(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.inbox.remove(user.id, id);
  }

  @Get('me/notification-preferences')
  @ApiOperation({ summary: 'Channels on offer and switched on for each notification type' })
  preferences(@CurrentUser() user: Me) {
    return this.inbox.preferences(user.id);
  }

  @Put('me/notification-preferences')
  async setPreferences(@CurrentUser() user: Me, @ZodBody(notificationPreferencesSchema) body: z.output<typeof notificationPreferencesSchema>) {
    return withMessage(await this.inbox.setPreferences(user.id, body.preferences), t('api.notifications.saved'));
  }

  @Public()
  @Get('push/config')
  @ApiOperation({ summary: 'The VAPID public key browsers subscribe with (null when web push is not set up)' })
  pushConfig() {
    return { publicKey: this.push.publicKey };
  }

  @Post('me/push-subscriptions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register this browser (Web Push) or app install (Expo token) for push notifications' })
  subscribe(@CurrentUser() user: Me, @ZodBody(pushSubscriptionSchema) body: z.output<typeof pushSubscriptionSchema>) {
    return this.inbox.subscribe(user.id, body, requestContext.get()?.userAgent ?? undefined);
  }

  @Delete('me/push-subscriptions')
  unsubscribe(@CurrentUser() user: Me, @ZodBody(pushUnsubscribeSchema) body: { endpoint: string }) {
    return this.inbox.unsubscribe(user.id, body.endpoint);
  }

  @Post('me/push-subscriptions/test')
  @HttpCode(200)
  async test(@CurrentUser() user: Me) {
    return withMessage(await this.inbox.test(user.id, requestContext.get()?.locale === 'en' ? 'en' : 'bn'), t('api.notifications.testSent'));
  }
}

@ApiTags('admin')
@ApiBearerAuth('access-token')
@RequirePermissions('notifications.broadcast')
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly inbox: InboxService) {}

  @Post('broadcast')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send an announcement (both languages) to everyone or one group' })
  async broadcast(@CurrentUser() user: Me, @ZodBody(broadcastSchema) body: z.output<typeof broadcastSchema>) {
    const result = await this.inbox.broadcast(user.id, body);
    return withMessage(result, t('api.notifications.broadcastSent', { count: result.recipients }));
  }
}
