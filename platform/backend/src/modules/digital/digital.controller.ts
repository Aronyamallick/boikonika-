import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DIGITAL_ASSET_STATUSES, DIGITAL_FILE_MAX_MB, digitalOfferSchema, digitalUploadSchema, MAX_SAMPLE_PAGES, previewPercentSchema, sampleChapterSchema, takedownSchema } from '@boikonika/shared';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { requestContext } from '../../common/context/request-context';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { AppException } from '../../common/errors/app-exception';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { pageQuery } from '../../common/util/pagination';
import { ZodBody, ZodQuery, zodIssuesToDetails } from '../../common/validation/zod';
import { DigitalService } from './digital.service';

type Me = AuthenticatedUser;
const ebookUpload = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: DIGITAL_FILE_MAX_MB * 1024 * 1024, files: 1, fields: 2 } });
const pagesUpload = FilesInterceptor('pages', MAX_SAMPLE_PAGES, { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: MAX_SAMPLE_PAGES, fields: 2 } });
const adminQuery = pageQuery.extend({ status: z.enum(DIGITAL_ASSET_STATUSES).optional(), q: z.string().trim().max(100).optional() });

@ApiTags('digital library')
@ApiBearerAuth('access-token')
@Controller()
export class DigitalController {
  constructor(private readonly digital: DigitalService) {}

  // ------------------------------------------------------------------ rights holders

  @Get('studio/digital')
  @ApiOperation({ summary: 'Books I can publish digitally (as their verified author or publisher) with file, offer, samples and reach' })
  studio(@CurrentUser() user: Me) {
    return this.digital.studio(user.id);
  }

  @Post('studio/digital/:bookId/file')
  @HttpCode(201)
  @UseInterceptors(ebookUpload)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: `Upload or replace the e-book (PDF or EPUB, up to ${DIGITAL_FILE_MAX_MB} MB) with a rights declaration as JSON in \`data\`` })
  async upload(@CurrentUser() user: Me, @Param('bookId', new ParseUUIDPipe()) bookId: string, @Body('data') raw: string | undefined, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw AppException.validation([{ field: 'file', code: 'required', message: 'validation.required' }]);
    let json: unknown;
    try {
      json = JSON.parse(raw ?? '');
    } catch {
      throw AppException.validation([{ field: 'data', code: 'invalid_json', message: 'errors.badJson' }]);
    }
    const parsed = digitalUploadSchema.safeParse(json);
    if (!parsed.success) throw AppException.validation(zodIssuesToDetails(parsed.error));
    return withMessage(await this.digital.upload(user.id, bookId, file.buffer, parsed.data, requestContext.get()?.ip ?? undefined), t('api.digital.uploaded'));
  }

  @Put('studio/digital/:bookId/offer')
  @ApiOperation({ summary: 'Offer the e-book free to everyone, or for sale through my store' })
  async offer(@CurrentUser() user: Me, @Param('bookId', new ParseUUIDPipe()) bookId: string, @ZodBody(digitalOfferSchema) body: z.output<typeof digitalOfferSchema>) {
    return withMessage(await this.digital.setOffer(user.id, bookId, body), t(body.free ? 'api.digital.offeredFree' : 'api.digital.offeredPaid'));
  }

  @Delete('studio/digital/:bookId/offer')
  @ApiOperation({ summary: 'Stop offering the e-book (readers who have it keep access)' })
  async withdraw(@CurrentUser() user: Me, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return withMessage(await this.digital.withdraw(user.id, bookId), t('api.digital.withdrawn'));
  }

  @Put('studio/digital/:bookId/preview-length')
  @ApiOperation({ summary: 'How much of the PDF is shown as the free sample (percent, within the site limit)' })
  async previewLength(@CurrentUser() user: Me, @Param('bookId', new ParseUUIDPipe()) bookId: string, @ZodBody(previewPercentSchema) body: { previewPercent: number }) {
    return withMessage(await this.digital.setPreviewPercent(user.id, bookId, body.previewPercent), t('api.digital.sampleUpdated'));
  }

  @Post('studio/digital/:bookId/chapters')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a sample chapter (text)' })
  async chapter(@CurrentUser() user: Me, @Param('bookId', new ParseUUIDPipe()) bookId: string, @ZodBody(sampleChapterSchema) body: z.output<typeof sampleChapterSchema>) {
    return withMessage(await this.digital.addChapter(user.id, bookId, body), t('api.digital.sampleAdded'));
  }

  @Post('studio/digital/:bookId/pages')
  @HttpCode(201)
  @UseInterceptors(pagesUpload)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: `Add sample page images (up to ${MAX_SAMPLE_PAGES}, optional \`title\`)` })
  async pages(@CurrentUser() user: Me, @Param('bookId', new ParseUUIDPipe()) bookId: string, @Body('title') title: string | undefined, @UploadedFiles() files: Express.Multer.File[] = []) {
    return withMessage(await this.digital.addPages(user.id, bookId, files.map((f) => f.buffer), title), t('api.digital.sampleAdded'));
  }

  @Delete('studio/digital/previews/:id')
  @ApiOperation({ summary: 'Remove a sample' })
  async removePreview(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string) {
    return withMessage(await this.digital.removePreview(user.id, id), t('api.digital.sampleRemoved'));
  }

  @Post('studio/digital/:bookId/file-link')
  @HttpCode(200)
  @ApiOperation({ summary: 'A short-lived link to my own uploaded file' })
  ownFile(@CurrentUser() user: Me, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return this.digital.ownFile(user.id, bookId);
  }

  // ------------------------------------------------------------------ readers

  @Post('me/library/:bookId/free')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add a free e-book to my library' })
  async claimFree(@CurrentUser() user: Me, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    return withMessage(await this.digital.claimFree(user.id, bookId), t('api.digital.addedFree'));
  }

  @Post('me/library/:bookId/download')
  @HttpCode(200)
  @ApiOperation({ summary: 'A short-lived download link for an e-book I am entitled to (logged, capped per day)' })
  download(@CurrentUser() user: Me, @Param('bookId', new ParseUUIDPipe()) bookId: string) {
    const ctx = requestContext.get();
    return this.digital.download(user.id, bookId, { ip: ctx?.ip ?? undefined, userAgent: ctx?.userAgent ?? undefined });
  }

  @Get('me/downloads')
  @ApiOperation({ summary: 'My download history' })
  async downloads(@CurrentUser() user: Me, @ZodQuery(pageQuery) q: z.output<typeof pageQuery>) {
    const { items, meta } = await this.digital.downloadHistory(user.id, q.page, q.pageSize);
    return paginated(items, meta);
  }

  @Public()
  @Get('books/:slug/preview')
  @ApiOperation({ summary: 'Look inside: description, contents, sample chapters, sample pages and the sample PDF' })
  preview(@Param('slug') slug: string) {
    return this.digital.preview(slug);
  }
}

@ApiTags('admin')
@ApiBearerAuth('access-token')
@RequirePermissions('copyright.manage')
@Controller('admin/digital')
export class AdminDigitalController {
  constructor(private readonly digital: DigitalService) {}

  @Get()
  @ApiOperation({ summary: 'Uploaded e-book files with their rights declarations' })
  async list(@ZodQuery(adminQuery) q: z.output<typeof adminQuery>) {
    const { items, meta } = await this.digital.adminList(q);
    return paginated(items, meta);
  }

  @Post(':id/takedown')
  @HttpCode(200)
  @ApiOperation({ summary: 'Take a file down (copyright): no downloads, no sales, file kept privately for a counter-notice' })
  async takedown(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(takedownSchema) body: { reason: string }) {
    return withMessage(await this.digital.takedown(user.id, id, body.reason), t('api.digital.takenDown'));
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore a taken-down file (counter-notice accepted); it comes back withdrawn' })
  async restore(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string) {
    return withMessage(await this.digital.restore(user.id, id), t('api.digital.restored'));
  }
}
