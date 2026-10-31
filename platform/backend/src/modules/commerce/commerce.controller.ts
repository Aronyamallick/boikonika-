import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addCartItemSchema,
  addressSchema,
  cancelOrderSchema,
  checkoutQuoteSchema,
  checkoutSchema,
  couponCodeSchema,
  mergeCartSchema,
  payOrderSchema,
  returnRequestSchema,
  updateCartItemSchema,
} from '@boikonika/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { requestContext } from '../../common/context/request-context';
import { AppException } from '../../common/errors/app-exception';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { pageQuery } from '../../common/util/pagination';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { AddressesService } from './addresses.service';
import { CartService, type CartOwner } from './cart.service';
import { OrdersService } from './orders.service';
import { BkashGateway } from './payments/bkash.gateway';
import { PaymentsService } from './payments/payments.service';
import { PricingService } from './pricing.service';
import { ReturnsService } from './returns.service';
import { WishlistService } from './wishlist.service';

const ownerOf = (user: AuthenticatedUser | undefined, token: string | undefined): CartOwner => ({ userId: user?.id, guestToken: user ? undefined : token && /^[A-Za-z0-9_-]{32,64}$/.test(token) ? token : undefined });

@ApiTags('addresses')
@ApiBearerAuth('access-token')
@Controller('me/addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.list(user.id);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthenticatedUser, @ZodBody(addressSchema) body: z.output<typeof addressSchema>) {
    return this.addresses.create(user.id, body);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(addressSchema) body: z.output<typeof addressSchema>) {
    return this.addresses.update(user.id, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.addresses.remove(user.id, id);
    return null;
  }
}

/**
 * Cart for signed-in users and guests. Guests get a random token (`guestToken`) on their first add and
 * send it back as `X-Cart-Token`; after signing in, `POST /cart/merge` moves the guest cart over.
 */
@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Cart with live prices and stock, grouped by seller' })
  view(@CurrentUser() user: AuthenticatedUser | undefined, @Headers('x-cart-token') token?: string) {
    return this.cart.view(ownerOf(user, token));
  }

  @Public()
  @Post('items')
  @HttpCode(200)
  async add(@CurrentUser() user: AuthenticatedUser | undefined, @Headers('x-cart-token') token: string | undefined, @ZodBody(addCartItemSchema) body: z.output<typeof addCartItemSchema>) {
    const owner = ownerOf(user, token);
    const { guestToken } = await this.cart.add(owner, body.variantId, body.quantity);
    return withMessage(await this.cart.view({ ...owner, guestToken: guestToken ?? owner.guestToken }), t('api.commerce.added'));
  }

  @Public()
  @Patch('items/:variantId')
  async update(@CurrentUser() user: AuthenticatedUser | undefined, @Headers('x-cart-token') token: string | undefined, @Param('variantId', new ParseUUIDPipe()) variantId: string, @ZodBody(updateCartItemSchema) body: z.output<typeof updateCartItemSchema>) {
    const owner = ownerOf(user, token);
    await this.cart.update(owner, variantId, body);
    return this.cart.view(owner);
  }

  @Public()
  @Delete('items/:variantId')
  async remove(@CurrentUser() user: AuthenticatedUser | undefined, @Headers('x-cart-token') token: string | undefined, @Param('variantId', new ParseUUIDPipe()) variantId: string) {
    const owner = ownerOf(user, token);
    await this.cart.remove(owner, variantId);
    return this.cart.view(owner);
  }

  @Put('coupon')
  @ApiBearerAuth('access-token')
  async coupon(@CurrentUser() user: AuthenticatedUser, @ZodBody(couponCodeSchema) body: { code: string }) {
    await this.cart.setCoupon({ userId: user.id }, body.code);
    return this.cart.view({ userId: user.id });
  }

  @Delete('coupon')
  @ApiBearerAuth('access-token')
  async removeCoupon(@CurrentUser() user: AuthenticatedUser) {
    await this.cart.setCoupon({ userId: user.id }, null);
    return this.cart.view({ userId: user.id });
  }

  @Post('merge')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Move a guest cart into the signed-in user’s cart' })
  async merge(@CurrentUser() user: AuthenticatedUser, @ZodBody(mergeCartSchema) body: { guestToken: string }) {
    await this.cart.merge(user.id, body.guestToken);
    return this.cart.view({ userId: user.id });
  }
}

@ApiTags('checkout')
@ApiBearerAuth('access-token')
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly cart: CartService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly orders: OrdersService,
  ) {}

  @Public()
  @Get('options')
  @ApiOperation({ summary: 'Delivery options and the payment methods that are currently available' })
  async options() {
    return { shippingMethods: await this.pricing.shippingMethodsList(), paymentMethods: this.payments.availableMethods() };
  }

  @Post('quote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Price the cart for an address, delivery option and coupon (nothing is reserved)' })
  async quote(@CurrentUser() user: AuthenticatedUser, @ZodBody(checkoutQuoteSchema) body: z.output<typeof checkoutQuoteSchema>) {
    const cart = await this.cart.resolve({ userId: user.id }, false);
    const lines = cart ? await this.cart.lines(cart.id) : [];
    const quote = await this.pricing.quote({ userId: user.id, lines, addressId: body.addressId, shippingMethod: body.shippingMethod, couponCode: body.couponCode ?? cart?.couponCode ?? undefined });
    return {
      ...quote,
      address: quote.address ? { id: quote.address.id } : null,
      coupon: quote.coupon ? { code: quote.coupon.code, applied: quote.coupon.applied, discount: quote.coupon.discount, message: quote.coupon.message ? t(quote.coupon.message, quote.coupon.params) : undefined } : null,
      groups: quote.groups.map((g) => ({
        seller: { id: g.seller.id, name: g.seller.name, slug: g.seller.slug },
        itemsSubtotal: g.itemsSubtotal,
        itemDiscount: g.itemDiscount,
        shippingFee: g.shippingFee,
        shippingDiscount: g.shippingDiscount,
        total: g.total,
        items: g.lines.map((l) => ({ variantId: l.variantId, title: l.title, variantName: l.variantName, condition: l.condition, imageUrl: l.imageUrl, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, lineTotal: l.lineTotal })),
      })),
      paymentMethods: quote.paymentMethods.map((m) => ({ ...m, reason: m.reason ? t(m.reason) : undefined })),
    };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Place the order (idempotent per key); returns where to pay for online methods' })
  async place(@CurrentUser() user: AuthenticatedUser, @ZodBody(checkoutSchema) body: z.output<typeof checkoutSchema>) {
    const result = await this.orders.checkout(user.id, body, requestContext.get()?.ip ?? undefined);
    return withMessage(result, t(result.order.paymentMethod === 'cod' ? 'api.commerce.orderPlaced' : 'api.commerce.orderPlacedPay'));
  }
}

@ApiTags('orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly returns: ReturnsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @ZodQuery(pageQuery) q: z.output<typeof pageQuery>) {
    const { items, meta } = await this.orders.listForBuyer(user.id, q.page, Math.min(q.pageSize, 50));
    return paginated(items, meta);
  }

  @Get(':number')
  async detail(@CurrentUser() user: AuthenticatedUser, @Param('number') number: string) {
    return this.orders.detail(await this.orders.ownOrder(user.id, number));
  }

  @Post(':number/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param('number') number: string, @ZodBody(cancelOrderSchema) body: { reason: string }) {
    const order = await this.orders.ownOrder(user.id, number);
    await this.orders.cancel(order, { id: user.id, role: 'buyer' }, body.reason);
    return withMessage(await this.orders.detail(await this.orders.ownOrder(user.id, number)), t('api.commerce.orderCancelled'));
  }

  @Post(':number/pay')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start a new payment attempt for an unpaid online order' })
  pay(@CurrentUser() user: AuthenticatedUser, @Param('number') number: string, @ZodBody(payOrderSchema) body: z.output<typeof payOrderSchema>) {
    return this.orders.payAgain(user.id, number, body.paymentMethod, body.idempotencyKey);
  }

  @Post(':number/returns')
  @HttpCode(201)
  async requestReturn(@CurrentUser() user: AuthenticatedUser, @Param('number') number: string, @ZodBody(returnRequestSchema) body: z.output<typeof returnRequestSchema>) {
    return withMessage(await this.returns.request(user.id, number, body), t('api.commerce.returnRequested'));
  }
}

const sandboxBody = z.object({ outcome: z.enum(['success', 'failure', 'cancel']) });

/**
 * Gateway return/notification endpoints. Parameters arriving here are never trusted on their own:
 * each result is confirmed with the provider's API before it changes an order.
 */
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly bkash: BkashGateway,
  ) {}

  @Public()
  @Get('bkash/callback')
  @ApiExcludeEndpoint()
  async bkashCallback(@Query('paymentID') paymentID: string | undefined, @Query('status') status: string | undefined, @Res() res: Response) {
    const payment = paymentID ? await this.payments.findByProviderId('bkash', paymentID.slice(0, 191)) : null;
    if (!payment) return res.redirect(303, this.payments.homeUrl());
    let outcome: 'success' | 'failed' | 'cancelled' = 'failed';
    const stored = this.payments.stored(payment);
    try {
      if (status === 'success') {
        const result = await this.bkash.execute(stored);
        const settled = result.status === 'pending' ? payment : await this.payments.settle(payment.id, result, 'callback');
        outcome = settled.status === 'paid' ? 'success' : 'failed';
      } else {
        // The browser says failure/cancel: confirm with bKash before closing the attempt.
        const result = await this.bkash.query(stored);
        const settled =
          result.status === 'paid'
            ? await this.payments.settle(payment.id, result, 'callback')
            : await this.payments.settle(payment.id, { status: status === 'cancel' ? 'cancelled' : 'failed', failureReason: `bkash_${(status ?? 'unknown').slice(0, 20)}`, raw: { status: status ?? null } }, 'callback');
        outcome = settled.status === 'paid' ? 'success' : status === 'cancel' ? 'cancelled' : 'failed';
      }
    } catch {
      outcome = 'failed';
    }
    return res.redirect(303, await this.payments.returnUrl(payment.id, outcome));
  }

  @Public()
  @Post('sslcommerz/:outcome')
  @HttpCode(303)
  @ApiExcludeEndpoint()
  async sslcommerzReturn(@Param('outcome') outcome: string, @Body() body: Record<string, unknown>, @Res() res: Response) {
    if (outcome === 'ipn') {
      await this.payments.handleSslcommerz(body).catch(() => undefined);
      return res.status(200).json({ received: true });
    }
    const payment = await this.payments.handleSslcommerz(body).catch(() => null);
    if (!payment) return res.redirect(303, this.payments.homeUrl());
    const result = payment.status === 'paid' ? 'success' : outcome === 'cancel' ? 'cancelled' : 'failed';
    return res.redirect(303, await this.payments.returnUrl(payment.id, result));
  }

  @Get('sandbox/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Test payment page data (development only)' })
  async sandbox(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    const payment = await this.payments.ownedSandboxPayment(user.id, id);
    return { id: payment.id, amount: payment.amount, status: payment.status, orderNumber: payment.orderNumber };
  }

  @Post('sandbox/:id/complete')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  async sandboxComplete(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(sandboxBody) body: z.output<typeof sandboxBody>) {
    const payment = await this.payments.ownedSandboxPayment(user.id, id);
    if (payment.status !== 'pending') throw new AppException('CONFLICT', 'api.commerce.paymentNotPending');
    const settled = await this.payments.settle(payment.id, this.payments.sandbox.outcome(this.payments.stored(payment), body.outcome), 'sandbox');
    return { status: settled.status, orderNumber: payment.orderNumber };
  }
}

const wishlistContainsQuery = z.object({
  books: z.string().max(2000).optional().transform((v) => (v ? v.split(',').filter((id) => z.uuid().safeParse(id).success).slice(0, 100) : [])),
  products: z.string().max(2000).optional().transform((v) => (v ? v.split(',').filter((id) => z.uuid().safeParse(id).success).slice(0, 100) : [])),
});

@ApiTags('wishlist')
@ApiBearerAuth('access-token')
@Controller('me/wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'My saved books and products' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.wishlist.list(user.id);
  }

  @Get('contains')
  @ApiOperation({ summary: 'Which of these books/products (comma-separated ids) I have saved' })
  contains(@CurrentUser() user: AuthenticatedUser, @ZodQuery(wishlistContainsQuery) q: z.output<typeof wishlistContainsQuery>) {
    return this.wishlist.contains(user.id, q.books, q.products);
  }

  @Put(':kind/:id')
  async add(@CurrentUser() user: AuthenticatedUser, @Param('kind', new ParseEnumPipe(['books', 'products'])) kind: 'books' | 'products', @Param('id', new ParseUUIDPipe()) id: string) {
    return withMessage(await this.wishlist.add(user.id, { kind: kind === 'books' ? 'book' : 'product', id }), t('api.wishlist.saved'));
  }

  @Delete(':kind/:id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('kind', new ParseEnumPipe(['books', 'products'])) kind: 'books' | 'products', @Param('id', new ParseUUIDPipe()) id: string) {
    return withMessage(await this.wishlist.remove(user.id, { kind: kind === 'books' ? 'book' : 'product', id }), t('api.wishlist.removed'));
  }
}
