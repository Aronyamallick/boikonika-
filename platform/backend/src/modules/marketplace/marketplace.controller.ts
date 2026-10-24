import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isbnSchema, moderationDecisionSchema, PRODUCT_STATUSES, sellerBookListingSchema, sellerProductSchema, stockAdjustSchema, storeSettingsSchema, updateListingSchema } from '@boikonika/shared';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppException } from '../../common/errors/app-exception';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { pageQuery } from '../../common/util/pagination';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { AdminProductsService } from './admin-products.service';
import { SellerProductsService } from './seller-products.service';
import { SellersService } from './sellers.service';

const image = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const images = FilesInterceptor('images', 8, { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 8 } });
const listQuery = pageQuery.extend({ status: z.enum(PRODUCT_STATUSES).optional(), q: z.string().trim().max(200).optional(), type: z.enum(['book', 'general']).optional() });

@ApiTags('seller')
@ApiBearerAuth('access-token')
@Controller('seller')
export class SellerController {
  constructor(
    private readonly sellers: SellersService,
    private readonly listings: SellerProductsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'My seller account and store' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.sellers.me(user.id);
  }

  @Patch('store')
  @ApiOperation({ summary: 'Update store details and policies' })
  async updateStore(@CurrentUser() user: AuthenticatedUser, @ZodBody(storeSettingsSchema) body: z.output<typeof storeSettingsSchema>) {
    return withMessage(await this.sellers.updateStore(user.id, body), t('api.marketplace.storeUpdated'));
  }

  @Put('store/:kind')
  @UseInterceptors(image)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload the store logo or banner' })
  storeImage(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string, @UploadedFile() file?: Express.Multer.File) {
    if (kind !== 'logo' && kind !== 'banner') throw AppException.notFound();
    if (!file) throw AppException.validation([{ field: 'file', code: 'required', message: 'validation.required' }]);
    return this.sellers.setStoreImage(user.id, kind, file.buffer);
  }

  @Get('products')
  @ApiOperation({ summary: 'My listings' })
  async list(@CurrentUser() user: AuthenticatedUser, @ZodQuery(listQuery) q: z.output<typeof listQuery>) {
    const { items, meta } = await this.listings.list(user.id, q);
    return paginated(items, meta);
  }

  @Get('books/lookup')
  @ApiOperation({ summary: 'Find an existing edition by ISBN before listing it' })
  lookup(@CurrentUser() user: AuthenticatedUser, @ZodQuery(z.object({ isbn: isbnSchema })) q: { isbn: string }) {
    return this.listings.lookupIsbn(user.id, q.isbn);
  }

  @Post('books')
  @HttpCode(201)
  @ApiOperation({ summary: 'List a book (existing edition by ISBN/id, or a new book record) with condition, price and stock' })
  async createBook(@CurrentUser() user: AuthenticatedUser, @ZodBody(sellerBookListingSchema) body: z.output<typeof sellerBookListingSchema>) {
    const result = await this.listings.createBookListing(user.id, body);
    return withMessage(result, t(result.message));
  }

  @Post('products')
  @HttpCode(201)
  @ApiOperation({ summary: 'List a general product with variants and stock' })
  async createProduct(@CurrentUser() user: AuthenticatedUser, @ZodBody(sellerProductSchema) body: z.output<typeof sellerProductSchema>) {
    const result = await this.listings.createProduct(user.id, body);
    return withMessage(result, t(result.message));
  }

  @Get('products/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.listings.get(user.id, id);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Edit a listing (details, status, variant prices)' })
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(updateListingSchema) body: z.output<typeof updateListingSchema>) {
    return withMessage(await this.listings.update(user.id, id, body), t('api.marketplace.listingUpdated'));
  }

  @Delete('products/:id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.listings.remove(user.id, id);
    return withMessage(null, t('api.marketplace.listingDeleted'));
  }

  @Post('products/:id/images')
  @HttpCode(200)
  @UseInterceptors(images)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add photos (up to 8 per listing; resized to WebP, metadata removed)' })
  addImages(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @UploadedFiles() files: Express.Multer.File[] = []) {
    if (!files.length) throw AppException.validation([{ field: 'images', code: 'required', message: 'validation.required' }]);
    return this.listings.addImages(user.id, id, files.map((f) => f.buffer));
  }

  @Delete('products/:id/images/:imageId')
  removeImage(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Param('imageId', new ParseUUIDPipe()) imageId: string) {
    return this.listings.removeImage(user.id, id, imageId);
  }

  @Post('inventory/adjust')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change stock (restock, correction, damage, return) — recorded in the stock ledger' })
  async adjust(@CurrentUser() user: AuthenticatedUser, @ZodBody(stockAdjustSchema) body: z.output<typeof stockAdjustSchema>) {
    return withMessage(await this.listings.adjustStock(user.id, body), t('api.marketplace.stockUpdated'));
  }

  @Get('inventory/:variantId/movements')
  movements(@CurrentUser() user: AuthenticatedUser, @Param('variantId', new ParseUUIDPipe()) variantId: string) {
    return this.listings.movements(user.id, variantId);
  }
}

const adminList = pageQuery.extend({ status: z.enum(PRODUCT_STATUSES).optional(), q: z.string().trim().max(200).optional() });

@ApiTags('admin · listings')
@ApiBearerAuth('access-token')
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly moderation: AdminProductsService) {}

  @Get()
  @RequirePermissions('products.view')
  async list(@ZodQuery(adminList) q: z.output<typeof adminList>) {
    const { items, meta } = await this.moderation.list(q);
    return paginated(items, meta);
  }

  @Post(':id/:decision')
  @HttpCode(200)
  @RequirePermissions('products.moderate')
  @ApiOperation({ summary: 'approve | reject | suspend | restore a listing (reason required to reject or suspend)' })
  async decide(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Param('decision') decision: string, @ZodBody(moderationDecisionSchema) body: z.output<typeof moderationDecisionSchema>) {
    if (!['approve', 'reject', 'suspend', 'restore'].includes(decision)) throw AppException.notFound();
    const key = { approve: 'approved', reject: 'rejected', suspend: 'suspended', restore: 'restored' }[decision as 'approve'];
    return withMessage(await this.moderation.decide(id, decision as 'approve', actor.id, body.reason), t(`api.marketplace.${key}`));
  }
}
