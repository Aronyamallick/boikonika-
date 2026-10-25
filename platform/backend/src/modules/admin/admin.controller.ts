import { Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { adminUserQuerySchema, auditQuerySchema, settingsUpdateSchema, userStatusSchema } from '@boikonika/shared';
import { z } from 'zod';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { ModerationAdminService } from '../moderation/moderation-admin.service';
import { AdminService } from './admin.service';

type Me = AuthenticatedUser;
const overviewQuery = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d)).default(30) });

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly moderation: ModerationAdminService,
  ) {}

  @Get('overview')
  @RequirePermissions('analytics.view')
  @ApiOperation({ summary: 'Platform KPIs, work queues, daily trend and what is popular (counts only, no personal data)' })
  overview(@ZodQuery(overviewQuery) q: { days: number }) {
    return this.admin.overview(q.days);
  }

  @Get('users')
  @RequirePermissions('users.view')
  async users(@ZodQuery(adminUserQuerySchema) q: z.output<typeof adminUserQuerySchema>) {
    const { items, meta } = await this.admin.users(q);
    return paginated(items, meta);
  }

  @Get('users/:id')
  @RequirePermissions('users.view')
  user(@CurrentUser() actor: Me, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.user(actor.id, id);
  }

  @Put('users/:id/status')
  @RequirePermissions('users.ban')
  @ApiOperation({ summary: 'Suspend, ban or reactivate an account (recorded as a moderation action)' })
  async status(@CurrentUser() actor: Me, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(userStatusSchema) body: z.output<typeof userStatusSchema>) {
    return withMessage(await this.moderation.setAccountStatus(actor.id, id, body), t('api.moderation.statusChanged'));
  }

  @Get('audit-logs')
  @RequirePermissions('audit.view')
  async audit(@ZodQuery(auditQuerySchema) q: z.output<typeof auditQuerySchema>) {
    const { items, meta } = await this.admin.auditLog(q);
    return paginated(items, meta);
  }

  @Get('settings')
  @RequirePermissions('settings.manage')
  settings() {
    return this.admin.settingsList();
  }

  @Put('settings')
  @RequirePermissions('settings.manage')
  async updateSettings(@CurrentUser() actor: Me, @ZodBody(settingsUpdateSchema) body: z.output<typeof settingsUpdateSchema>) {
    return withMessage(await this.admin.updateSettings(actor.id, body.values), t('api.admin.settingsSaved'));
  }
}
