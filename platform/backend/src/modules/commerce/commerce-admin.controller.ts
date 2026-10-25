import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cancelOrderSchema,
  couponSchema,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  payoutAccountSchema,
  payoutFailedSchema,
  payoutPaidSchema,
  REFUND_STATUSES,
  refundSchema,
  returnDecisionSchema,
  returnReceivedSchema,
  sellerOrderUpdateSchema,
} from '@boikonika/shared';
import { z } from 'zod';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { pageQuery } from '../../common/util/pagination';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { CouponsService } from './coupons.service';
import { OrdersService } from './orders.service';
import { PayoutsService } from './payouts.service';
import { RefundsService } from './refunds.service';
import { ReturnsService } from './returns.service';
import { SellerOrdersService } from './seller-orders.service';

const sellerOrderQuery = pageQuery.extend({ status: z.enum(ORDER_STATUSES).optional(), returns: z.literal('requested').optional(), q: z.string().trim().max(60).optional() });

@ApiTags('seller')
@ApiBearerAuth('access-token')
@Controller('seller')
export class SellerCommerceController {
  constructor(
    private readonly sellerOrders: SellerOrdersService,
    private readonly returns: ReturnsService,
    private readonly payouts: PayoutsService,
  ) {}

  @Get('orders')
  @ApiOperation({ summary: 'My sub-orders (online orders appear once paid)' })
  async orders(@CurrentUser() user: AuthenticatedUser, @ZodQuery(sellerOrderQuery) q: z.output<typeof sellerOrderQuery>) {
    const { items, meta } = await this.sellerOrders.list(user.id, q);
    return paginated(items, meta);
  }

  @Get('orders-summary')
  @ApiOperation({ summary: 'How many of my sub-orders are in each status' })
  counts(@CurrentUser() user: AuthenticatedUser) {
    return this.sellerOrders.counts(user.id);
  }

  @Get('orders/:id')
  order(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.sellerOrders.detail(user.id, id);
  }

  @Post('orders/:id/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm, pack, ship (with tracking), mark delivered or cancel (with a reason)' })
  async status(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(sellerOrderUpdateSchema) body: z.output<typeof sellerOrderUpdateSchema>) {
    return withMessage(await this.sellerOrders.update(user.id, id, body), t('api.commerce.orderUpdated'));
  }

  @Post('returns/:id/decision')
  @HttpCode(200)
  async decide(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(returnDecisionSchema) body: z.output<typeof returnDecisionSchema>) {
    await this.returns.decide(user.id, id, body);
    return withMessage(null, t(body.approve ? 'api.commerce.returnApproved' : 'api.commerce.returnRejected'));
  }

  @Post('returns/:id/received')
  @HttpCode(200)
  async received(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(returnReceivedSchema) body: z.output<typeof returnReceivedSchema>) {
    await this.returns.received(user.id, id, body.restock);
    return withMessage(null, t('api.commerce.returnReceived'));
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Balance (available, pending), payout history and payout accounts' })
  payoutSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.payouts.summary(user.id);
  }

  @Post('payout-accounts')
  @HttpCode(201)
  async addAccount(@CurrentUser() user: AuthenticatedUser, @ZodBody(payoutAccountSchema) body: z.output<typeof payoutAccountSchema>) {
    return withMessage(await this.payouts.addAccount(user.id, body), t('api.commerce.payoutAccountSaved'));
  }

  @Delete('payout-accounts/:id')
  removeAccount(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payouts.removeAccount(user.id, id);
  }
}

const adminOrderQuery = pageQuery.extend({ status: z.enum(ORDER_STATUSES).optional(), paymentStatus: z.enum(PAYMENT_STATUSES).optional(), q: z.string().trim().max(80).optional() });
const refundQuery = pageQuery.extend({ status: z.enum(REFUND_STATUSES).optional() });
const payoutQuery = pageQuery.extend({ status: z.enum(PAYOUT_STATUSES).optional() });
const couponQuery = pageQuery.extend({ q: z.string().trim().max(40).optional() });
const createPayout = z.object({ sellerId: z.uuid() });
const completeRefund = z.object({ reference: z.string().trim().min(3).max(120) });

@ApiTags('admin · commerce')
@ApiBearerAuth('access-token')
@Controller('admin')
export class AdminCommerceController {
  constructor(
    private readonly orders: OrdersService,
    private readonly refunds: RefundsService,
    private readonly payouts: PayoutsService,
    private readonly coupons: CouponsService,
  ) {}

  @Get('orders')
  @RequirePermissions('orders.view')
  async listOrders(@ZodQuery(adminOrderQuery) q: z.output<typeof adminOrderQuery>) {
    const { items, meta } = await this.orders.adminList(q);
    return paginated(items, meta);
  }

  @Get('orders/:number')
  @RequirePermissions('orders.view')
  async order(@Param('number') number: string) {
    return this.orders.detail(await this.orders.byNumber(number));
  }

  @Post('orders/:number/cancel')
  @HttpCode(200)
  @RequirePermissions('orders.manage')
  async cancel(@CurrentUser() actor: AuthenticatedUser, @Param('number') number: string, @ZodBody(cancelOrderSchema) body: { reason: string }) {
    await this.orders.cancel(await this.orders.byNumber(number), { id: actor.id, role: 'admin' }, body.reason);
    return withMessage(await this.orders.detail(await this.orders.byNumber(number)), t('api.commerce.orderCancelled'));
  }

  @Post('orders/:number/refunds')
  @HttpCode(201)
  @RequirePermissions('orders.refund')
  async refund(@CurrentUser() actor: AuthenticatedUser, @Param('number') number: string, @ZodBody(refundSchema) body: z.output<typeof refundSchema>) {
    const order = await this.orders.byNumber(number);
    const refund = await this.refunds.createManual(actor.id, order.id, body);
    return withMessage({ id: refund.id, status: refund.status }, t('api.commerce.refundCreated'));
  }

  @Get('refunds')
  @RequirePermissions('orders.refund')
  async listRefunds(@ZodQuery(refundQuery) q: z.output<typeof refundQuery>) {
    const { items, meta } = await this.refunds.list(q);
    return paginated(items, meta);
  }

  @Post('refunds/:id/complete')
  @HttpCode(200)
  @RequirePermissions('orders.refund')
  @ApiOperation({ summary: 'Record a manual (bKash/bank) refund as paid — for cash-on-delivery orders' })
  async completeRefund(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(completeRefund) body: { reference: string }) {
    await this.refunds.complete(id, body.reference, actor.id);
    return withMessage(null, t('api.commerce.refundCompleted'));
  }

  @Post('refunds/:id/retry')
  @HttpCode(200)
  @RequirePermissions('orders.refund')
  async retryRefund(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.refunds.retry(id);
    return withMessage(null, t('api.commerce.refundRetry'));
  }

  @Get('payouts')
  @RequirePermissions('payouts.view')
  async listPayouts(@ZodQuery(payoutQuery) q: z.output<typeof payoutQuery>) {
    const { items, meta } = await this.payouts.list(q);
    return paginated(items, meta);
  }

  @Get('payouts/eligible')
  @RequirePermissions('payouts.view')
  eligible() {
    return this.payouts.eligibleSellers();
  }

  @Post('payouts')
  @HttpCode(201)
  @RequirePermissions('payouts.manage')
  async createPayout(@CurrentUser() actor: AuthenticatedUser, @ZodBody(createPayout) body: { sellerId: string }) {
    return withMessage(await this.payouts.create(actor.id, body.sellerId), t('api.commerce.payoutCreated'));
  }

  @Get('payouts/:id/account')
  @RequirePermissions('payouts.manage')
  @ApiOperation({ summary: 'Full payout account details for making the transfer (audited)' })
  account(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payouts.revealAccount(actor.id, id);
  }

  @Post('payouts/:id/paid')
  @HttpCode(200)
  @RequirePermissions('payouts.manage')
  async paid(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(payoutPaidSchema) body: z.output<typeof payoutPaidSchema>) {
    return withMessage(await this.payouts.markPaid(actor.id, id, body.reference, body.note), t('api.commerce.payoutPaid'));
  }

  @Post('payouts/:id/failed')
  @HttpCode(200)
  @RequirePermissions('payouts.manage')
  async failed(@CurrentUser() actor: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(payoutFailedSchema) body: { note: string }) {
    return withMessage(await this.payouts.markFailed(actor.id, id, body.note), t('api.commerce.payoutFailed'));
  }

  @Get('coupons')
  @RequirePermissions('coupons.manage')
  async listCoupons(@ZodQuery(couponQuery) q: z.output<typeof couponQuery>) {
    const { items, meta } = await this.coupons.list(q);
    return paginated(items, meta);
  }

  @Post('coupons')
  @HttpCode(201)
  @RequirePermissions('coupons.manage')
  async createCoupon(@CurrentUser() actor: AuthenticatedUser, @ZodBody(couponSchema) body: z.output<typeof couponSchema>) {
    return withMessage(await this.coupons.create(actor.id, body), t('api.commerce.couponSaved'));
  }

  @Patch('coupons/:id')
  @RequirePermissions('coupons.manage')
  async updateCoupon(@Param('id', new ParseUUIDPipe()) id: string, @ZodBody(couponSchema) body: z.output<typeof couponSchema>) {
    return withMessage(await this.coupons.update(id, body), t('api.commerce.couponSaved'));
  }
}
