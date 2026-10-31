import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { reportSchema } from '@boikonika/shared';
import type { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { t } from '../../common/i18n';
import { withMessage } from '../../common/http/response';
import { ZodBody } from '../../common/validation/zod';
import { ReportsService } from './reports.service';

@ApiTags('moderation')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Report a post, comment, review, listing, user, club or store' })
  async create(@CurrentUser() user: AuthenticatedUser, @ZodBody(reportSchema) body: z.output<typeof reportSchema>) {
    const result = await this.reports.create(user.id, body);
    return withMessage({ id: result.id }, t('api.moderation.reported'));
  }
}
