import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { authorAnnouncementSchema, authorClaimSchema, authorProfileSchema, claimDecisionSchema, publisherProfileSchema } from '@boikonika/shared';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { CurrentUser, RequirePermissions, RequireRoles, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppException } from '../../common/errors/app-exception';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { pageQuery } from '../../common/util/pagination';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { AuthorService } from './author.service';
import { PublisherService } from './publisher.service';
import { SellerDashboardService } from './seller-dashboard.service';

const image = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const requireFile = (file?: Express.Multer.File) => {
  if (!file) throw AppException.validation([{ field: 'file', code: 'required', message: 'validation.required' }]);
  return file.buffer;
};
const daysQuery = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d)).default(30) });

@ApiTags('seller')
@ApiBearerAuth('access-token')
@Controller('seller')
export class SellerDashboardController {
  constructor(private readonly dashboard: SellerDashboardService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Sales for 7/30/90 days vs the previous period, daily trend, to-dos, stock alerts, top items, reviews, balance' })
  overview(@CurrentUser() user: AuthenticatedUser, @ZodQuery(daysQuery) q: { days: number }) {
    return this.dashboard.overview(user.id, q.days);
  }
}

@ApiTags('author')
@ApiBearerAuth('access-token')
@RequireRoles('author')
@Controller('author')
export class AuthorController {
  constructor(private readonly authors: AuthorService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.authors.dashboard(user.id);
  }

  @Patch('profile')
  async profile(@CurrentUser() user: AuthenticatedUser, @ZodBody(authorProfileSchema) body: z.output<typeof authorProfileSchema>) {
    return withMessage(await this.authors.updateProfile(user.id, body), t('api.creators.profileSaved'));
  }

  @Put('photo')
  @UseInterceptors(image)
  @ApiConsumes('multipart/form-data')
  photo(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    return this.authors.setPhoto(user.id, requireFile(file));
  }

  @Post('announcements')
  @HttpCode(201)
  @ApiOperation({ summary: 'Post an update to followers (a few per day)' })
  async announce(@CurrentUser() user: AuthenticatedUser, @ZodBody(authorAnnouncementSchema) body: z.output<typeof authorAnnouncementSchema>) {
    const result = await this.authors.announce(user.id, body);
    return withMessage(result, t('api.creators.announced', { count: result.notified }));
  }

  @Get('claimable')
  @ApiOperation({ summary: 'Unclaimed author pages matching a name' })
  claimable(@Query('q') q = '') {
    return this.authors.claimable(String(q).slice(0, 120));
  }

  @Post('claims')
  @HttpCode(201)
  async claim(@CurrentUser() user: AuthenticatedUser, @ZodBody(authorClaimSchema) body: z.output<typeof authorClaimSchema>) {
    return withMessage(await this.authors.claim(user.id, body), t('api.creators.claimSubmitted'));
  }
}

@ApiTags('publisher')
@ApiBearerAuth('access-token')
@RequireRoles('publisher')
@Controller('publisher')
export class PublisherController {
  constructor(private readonly publishers: PublisherService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.publishers.dashboard(user.id);
  }

  @Patch('profile')
  async profile(@CurrentUser() user: AuthenticatedUser, @ZodBody(publisherProfileSchema) body: z.output<typeof publisherProfileSchema>) {
    return withMessage(await this.publishers.updateProfile(user.id, body), t('api.creators.profileSaved'));
  }

  @Put('logo')
  @UseInterceptors(image)
  @ApiConsumes('multipart/form-data')
  logo(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    return this.publishers.setLogo(user.id, requireFile(file));
  }
}

const claimQuery = pageQuery.extend({ status: z.enum(['pending', 'approved', 'rejected']).default('pending') });

@ApiTags('admin · authors')
@ApiBearerAuth('access-token')
@Controller('admin/author-claims')
export class AdminAuthorClaimsController {
  constructor(private readonly authors: AuthorService) {}

  @Get()
  @RequirePermissions('authors.manage')
  async list(@ZodQuery(claimQuery) q: z.output<typeof claimQuery>) {
    const { items, meta } = await this.authors.listClaims(q.status, q.page, q.pageSize);
    return paginated(items, meta);
  }

  @Post(':id/:decision')
  @HttpCode(200)
  @RequirePermissions('authors.manage')
  async decide(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Param('decision') decision: string, @ZodBody(claimDecisionSchema) body: { reason?: string }) {
    if (decision !== 'approve' && decision !== 'reject') throw AppException.notFound();
    await this.authors.decideClaim(actor.id, id, decision === 'approve', body.reason);
    return withMessage(null, t(decision === 'approve' ? 'api.creators.claimApproved' : 'api.creators.claimRejected'));
  }
}
