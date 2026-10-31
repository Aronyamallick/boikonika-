import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UploadedFiles, UseInterceptors, Body } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { KYC_PURPOSES, KYC_STATUSES, KYC_UPLOAD, kycDecisionSchema, kycRejectSchema, kycSubmitSchema, type KycStatus } from '@boikonika/shared';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AuthThrottle } from '../../common/decorators/throttle.decorators';
import { AppException } from '../../common/errors/app-exception';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { pageQuery } from '../../common/util/pagination';
import { toOpenApi, ZodBody, ZodQuery, zodIssuesToDetails } from '../../common/validation/zod';
import { KycService } from './kyc.service';

const documentsUpload = FilesInterceptor('documents', KYC_UPLOAD.maxFiles, { storage: memoryStorage(), limits: { fileSize: KYC_UPLOAD.maxBytes, files: KYC_UPLOAD.maxFiles, fields: 5 } });

@ApiTags('verification')
@ApiBearerAuth('access-token')
@Controller('kyc/verifications')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post()
  @HttpCode(201)
  @AuthThrottle()
  @UseInterceptors(documentsUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['data', 'documents'],
      properties: {
        data: { type: 'string', description: 'JSON matching the schema below; documents[i] describes the i-th file', example: JSON.stringify({ purpose: 'seller', requestedRole: 'book_seller', legalName: 'Rahim Uddin', documents: [{ type: 'nid', side: 'front', number: '1990123456789' }], declarations: { accurate: true, authorised: true } }) },
        documents: { type: 'array', items: { type: 'string', format: 'binary' } },
        schema: toOpenApi(kycSubmitSchema),
      },
    },
  })
  @ApiOperation({ summary: 'Apply for verification (seller, author, publisher, student, teacher, institution) with documents' })
  async submit(@CurrentUser() user: AuthenticatedUser, @Body('data') raw: string | undefined, @UploadedFiles() files: Express.Multer.File[] = []) {
    let json: unknown;
    try {
      json = JSON.parse(raw ?? '');
    } catch {
      throw AppException.validation([{ field: 'data', code: 'invalid_json', message: 'errors.badJson' }]);
    }
    const parsed = kycSubmitSchema.safeParse(json);
    if (!parsed.success) throw AppException.validation(zodIssuesToDetails(parsed.error));
    return withMessage(await this.kyc.submit(user.id, parsed.data, files.map((f) => f.buffer)), t('api.kyc.submitted'));
  }

  @Get()
  @ApiOperation({ summary: 'My verification requests with status timeline' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.kyc.listMine(user.id);
  }
}

const listQuery = pageQuery.extend({ status: z.enum(KYC_STATUSES).optional(), purpose: z.enum(KYC_PURPOSES).optional() });

@ApiTags('admin · verification')
@ApiBearerAuth('access-token')
@Controller('admin/kyc')
export class AdminKycController {
  constructor(private readonly kyc: KycService) {}

  @Get()
  @RequirePermissions('kyc.view')
  @ApiOperation({ summary: 'Verification queue (oldest first)' })
  async list(@ZodQuery(listQuery) q: z.output<typeof listQuery>) {
    const { items, meta } = await this.kyc.list({ status: q.status as KycStatus | undefined, purpose: q.purpose, page: q.page, pageSize: q.pageSize });
    return paginated(items, meta);
  }

  @Get(':id')
  @RequirePermissions('kyc.view')
  @ApiOperation({ summary: 'Verification details, documents (without files) and audit trail' })
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.kyc.detail(id);
  }

  @Get(':id/documents/:documentId')
  @RequirePermissions('kyc.documents.view')
  @ApiOperation({ summary: 'Open a document: 2-minute signed URL and full number (the view is logged)' })
  open(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Param('documentId', new ParseUUIDPipe()) documentId: string) {
    return this.kyc.openDocument(id, documentId, actor.id);
  }

  @Post(':id/review')
  @HttpCode(200)
  @RequirePermissions('kyc.view')
  @ApiOperation({ summary: 'Start reviewing (pending → under review)' })
  async review(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return withMessage(await this.kyc.startReview(id, actor.id), t('api.kyc.reviewStarted'));
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('kyc.approve')
  @ApiOperation({ summary: 'Approve: grants the requested role and notifies the applicant' })
  async approve(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(kycDecisionSchema) body: z.output<typeof kycDecisionSchema>) {
    return withMessage(await this.kyc.approve(id, actor.id, body.note), t('api.kyc.approved'));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions('kyc.reject')
  @ApiOperation({ summary: 'Reject with a reason shown to the applicant' })
  async reject(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(kycRejectSchema) body: z.output<typeof kycRejectSchema>) {
    return withMessage(await this.kyc.reject(id, actor.id, body.reason), t('api.kyc.rejected'));
  }

  @Post(':id/request-resubmission')
  @HttpCode(200)
  @RequirePermissions('kyc.reject')
  @ApiOperation({ summary: 'Ask the applicant to submit again (e.g. a blurry photo)' })
  async resubmit(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(kycRejectSchema) body: z.output<typeof kycRejectSchema>) {
    return withMessage(await this.kyc.requestResubmission(id, actor.id, body.reason), t('api.kyc.resubmissionRequested'));
  }
}
