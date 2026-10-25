import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminArticleQuerySchema,
  articleSchema,
  bannerSchema,
  cmsPageCreateSchema,
  cmsPageSchema,
  contactMessageQuerySchema,
  contactReplySchema,
  contactStatusSchema,
  faqSchema,
  reorderSchema,
  sectionCreateSchema,
  sectionUpdateSchema,
  testimonialSchema,
} from '@boikonika/shared';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppException } from '../../common/errors/app-exception';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { ZodBody, ZodQuery, zodIssuesToDetails } from '../../common/validation/zod';
import { CmsAdminService } from './cms-admin.service';
import { ContactService } from './contact.service';

type Me = AuthenticatedUser;
const uuid = new ParseUUIDPipe();
const cover = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const bannerImages = FileFieldsInterceptor(
  [
    { name: 'image', maxCount: 1 },
    { name: 'mobileImage', maxCount: 1 },
  ],
  { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 2 } },
);
type BannerFiles = { image?: Express.Multer.File[]; mobileImage?: Express.Multer.File[] };

/** Multipart forms carry their fields as JSON in `data`. */
function parseData<T extends z.ZodType>(schema: T, raw: string | undefined): z.output<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw ?? '');
  } catch {
    throw AppException.validation([{ field: 'data', code: 'invalid_json', message: 'errors.badJson' }]);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw AppException.validation(zodIssuesToDetails(parsed.error));
  return parsed.data;
}

@ApiTags('admin-content')
@ApiBearerAuth('access-token')
@Controller('admin')
export class CmsAdminController {
  constructor(
    private readonly cms: CmsAdminService,
    private readonly contact: ContactService,
  ) {}

  // ------------------------------------------------------------------ pages

  @Get('cms/pages')
  @RequirePermissions('cms.manage')
  pages() {
    return this.cms.pages();
  }

  @Get('cms/pages/:id')
  @RequirePermissions('cms.manage')
  page(@Param('id', uuid) id: string) {
    return this.cms.page(id);
  }

  @Post('cms/pages')
  @RequirePermissions('cms.manage')
  async createPage(@CurrentUser() me: Me, @ZodBody(cmsPageCreateSchema) body: z.output<typeof cmsPageCreateSchema>) {
    return withMessage(await this.cms.createPage(me.id, body), t('api.cms.saved'));
  }

  @Put('cms/pages/:id')
  @RequirePermissions('cms.manage')
  async updatePage(@CurrentUser() me: Me, @Param('id', uuid) id: string, @ZodBody(cmsPageSchema) body: z.output<typeof cmsPageSchema>) {
    return withMessage(await this.cms.updatePage(me.id, id, body), t('api.cms.saved'));
  }

  // ------------------------------------------------------------------ articles

  @Get('cms/articles')
  @RequirePermissions('cms.manage')
  async articles(@ZodQuery(adminArticleQuerySchema) q: z.output<typeof adminArticleQuerySchema>) {
    const { items, meta } = await this.cms.articles(q);
    return paginated(items, meta);
  }

  @Get('cms/articles/:id')
  @RequirePermissions('cms.manage')
  article(@Param('id', uuid) id: string) {
    return this.cms.article(id);
  }

  @Post('cms/articles')
  @RequirePermissions('cms.manage')
  async createArticle(@CurrentUser() me: Me, @ZodBody(articleSchema) body: z.output<typeof articleSchema>) {
    return withMessage(await this.cms.createArticle(me.id, body), t('api.cms.saved'));
  }

  @Put('cms/articles/:id')
  @RequirePermissions('cms.manage')
  async updateArticle(@CurrentUser() me: Me, @Param('id', uuid) id: string, @ZodBody(articleSchema) body: z.output<typeof articleSchema>) {
    return withMessage(await this.cms.updateArticle(me.id, id, body), t('api.cms.saved'));
  }

  @Put('cms/articles/:id/cover')
  @RequirePermissions('cms.manage')
  @UseInterceptors(cover)
  @ApiConsumes('multipart/form-data')
  async articleCover(@CurrentUser() me: Me, @Param('id', uuid) id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw AppException.validation([{ field: 'file', code: 'required', message: 'validation.required' }]);
    return withMessage(await this.cms.setArticleCover(me.id, id, file.buffer), t('api.cms.saved'));
  }

  @Delete('cms/articles/:id')
  @RequirePermissions('cms.manage')
  async deleteArticle(@CurrentUser() me: Me, @Param('id', uuid) id: string) {
    return withMessage(await this.cms.deleteArticle(me.id, id), t('api.cms.deleted'));
  }

  // ------------------------------------------------------------------ FAQs

  @Get('cms/faqs')
  @RequirePermissions('cms.manage')
  faqs() {
    return this.cms.faqList();
  }

  @Post('cms/faqs')
  @RequirePermissions('cms.manage')
  async createFaq(@CurrentUser() me: Me, @ZodBody(faqSchema) body: z.output<typeof faqSchema>) {
    return withMessage(await this.cms.createFaq(me.id, body), t('api.cms.saved'));
  }

  @Put('cms/faqs/order')
  @RequirePermissions('cms.manage')
  async reorderFaqs(@CurrentUser() me: Me, @ZodBody(reorderSchema) body: { ids: string[] }) {
    return withMessage(await this.cms.reorderFaqs(me.id, body.ids), t('api.cms.reordered'));
  }

  @Put('cms/faqs/:id')
  @RequirePermissions('cms.manage')
  async updateFaq(@CurrentUser() me: Me, @Param('id', uuid) id: string, @ZodBody(faqSchema) body: z.output<typeof faqSchema>) {
    return withMessage(await this.cms.updateFaq(me.id, id, body), t('api.cms.saved'));
  }

  @Delete('cms/faqs/:id')
  @RequirePermissions('cms.manage')
  async deleteFaq(@CurrentUser() me: Me, @Param('id', uuid) id: string) {
    return withMessage(await this.cms.deleteFaq(me.id, id), t('api.cms.deleted'));
  }

  // ------------------------------------------------------------------ banners

  @Get('cms/banners')
  @RequirePermissions('banners.manage')
  banners() {
    return this.cms.bannerList();
  }

  @Post('cms/banners')
  @RequirePermissions('banners.manage')
  @UseInterceptors(bannerImages)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add a banner (JSON in `data`; `image` 3:1, optional `mobileImage` 4:3)' })
  async createBanner(@CurrentUser() me: Me, @Body('data') raw: string | undefined, @UploadedFiles() files: BannerFiles = {}) {
    const input = parseData(bannerSchema, raw);
    return withMessage(await this.cms.createBanner(me.id, input, files.image?.[0]?.buffer, files.mobileImage?.[0]?.buffer), t('api.cms.saved'));
  }

  @Put('cms/banners/order')
  @RequirePermissions('banners.manage')
  async reorderBanners(@CurrentUser() me: Me, @ZodBody(reorderSchema) body: { ids: string[] }) {
    return withMessage(await this.cms.reorderBanners(me.id, body.ids), t('api.cms.reordered'));
  }

  @Put('cms/banners/:id')
  @RequirePermissions('banners.manage')
  @UseInterceptors(bannerImages)
  @ApiConsumes('multipart/form-data')
  async updateBanner(@CurrentUser() me: Me, @Param('id', uuid) id: string, @Body('data') raw: string | undefined, @UploadedFiles() files: BannerFiles = {}) {
    const input = parseData(bannerSchema.and(z.object({ removeMobileImage: z.boolean().default(false) })), raw);
    return withMessage(await this.cms.updateBanner(me.id, id, input, files.image?.[0]?.buffer, files.mobileImage?.[0]?.buffer, input.removeMobileImage), t('api.cms.saved'));
  }

  @Delete('cms/banners/:id')
  @RequirePermissions('banners.manage')
  async deleteBanner(@CurrentUser() me: Me, @Param('id', uuid) id: string) {
    return withMessage(await this.cms.deleteBanner(me.id, id), t('api.cms.deleted'));
  }

  // ------------------------------------------------------------------ homepage

  @Get('homepage/sections')
  @RequirePermissions('homepage.manage')
  sections() {
    return this.cms.sections();
  }

  @Post('homepage/sections')
  @RequirePermissions('homepage.manage')
  async createSection(@CurrentUser() me: Me, @ZodBody(sectionCreateSchema) body: z.output<typeof sectionCreateSchema>) {
    return withMessage(await this.cms.createSection(me.id, body), t('api.cms.saved'));
  }

  @Put('homepage/sections/order')
  @RequirePermissions('homepage.manage')
  async reorderSections(@CurrentUser() me: Me, @ZodBody(reorderSchema) body: { ids: string[] }) {
    return withMessage(await this.cms.reorderSections(me.id, body.ids), t('api.cms.reordered'));
  }

  @Put('homepage/sections/:id')
  @RequirePermissions('homepage.manage')
  async updateSection(@CurrentUser() me: Me, @Param('id', uuid) id: string, @ZodBody(sectionUpdateSchema) body: z.output<typeof sectionUpdateSchema>) {
    return withMessage(await this.cms.updateSection(me.id, id, body), t('api.cms.saved'));
  }

  @Delete('homepage/sections/:id')
  @RequirePermissions('homepage.manage')
  async deleteSection(@CurrentUser() me: Me, @Param('id', uuid) id: string) {
    return withMessage(await this.cms.deleteSection(me.id, id), t('api.cms.deleted'));
  }

  @Get('homepage/testimonials')
  @RequirePermissions('homepage.manage')
  testimonials() {
    return this.cms.testimonialList();
  }

  @Post('homepage/testimonials')
  @RequirePermissions('homepage.manage')
  async createTestimonial(@CurrentUser() me: Me, @ZodBody(testimonialSchema) body: z.output<typeof testimonialSchema>) {
    return withMessage(await this.cms.createTestimonial(me.id, body), t('api.cms.saved'));
  }

  @Put('homepage/testimonials/order')
  @RequirePermissions('homepage.manage')
  async reorderTestimonials(@CurrentUser() me: Me, @ZodBody(reorderSchema) body: { ids: string[] }) {
    return withMessage(await this.cms.reorderTestimonials(me.id, body.ids), t('api.cms.reordered'));
  }

  @Put('homepage/testimonials/:id')
  @RequirePermissions('homepage.manage')
  async updateTestimonial(@CurrentUser() me: Me, @Param('id', uuid) id: string, @ZodBody(testimonialSchema) body: z.output<typeof testimonialSchema>) {
    return withMessage(await this.cms.updateTestimonial(me.id, id, body), t('api.cms.saved'));
  }

  @Delete('homepage/testimonials/:id')
  @RequirePermissions('homepage.manage')
  async deleteTestimonial(@CurrentUser() me: Me, @Param('id', uuid) id: string) {
    return withMessage(await this.cms.deleteTestimonial(me.id, id), t('api.cms.deleted'));
  }

  // ------------------------------------------------------------------ contact messages

  @Get('messages')
  @RequirePermissions('support.manage')
  async messages(@ZodQuery(contactMessageQuerySchema) q: z.output<typeof contactMessageQuerySchema>) {
    const { items, meta } = await this.contact.list(q);
    return paginated(items, meta);
  }

  @Post('messages/:id/reply')
  @HttpCode(200)
  @RequirePermissions('support.manage')
  async reply(@CurrentUser() me: Me, @Param('id', uuid) id: string, @ZodBody(contactReplySchema) body: z.output<typeof contactReplySchema>) {
    return withMessage(await this.contact.reply(me.id, id, body), t('api.contact.replied'));
  }

  @Put('messages/:id/status')
  @RequirePermissions('support.manage')
  async status(@CurrentUser() me: Me, @Param('id', uuid) id: string, @ZodBody(contactStatusSchema) body: z.output<typeof contactStatusSchema>) {
    return withMessage(await this.contact.setStatus(me.id, id, body.status), t('api.contact.statusChanged'));
  }
}
