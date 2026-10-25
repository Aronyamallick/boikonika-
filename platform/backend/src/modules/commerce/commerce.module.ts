import { Module } from '@nestjs/common';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { AddressesService } from './addresses.service';
import { CartService } from './cart.service';
import { AdminCommerceController, SellerCommerceController } from './commerce-admin.controller';
import { AddressesController, CartController, CheckoutController, OrdersController, PaymentsController, WishlistController } from './commerce.controller';
import { CouponsService } from './coupons.service';
import { OrdersService } from './orders.service';
import { BkashGateway } from './payments/bkash.gateway';
import { PaymentsService } from './payments/payments.service';
import { SandboxGateway } from './payments/sandbox.gateway';
import { SslcommerzGateway } from './payments/sslcommerz.gateway';
import { PayoutsService } from './payouts.service';
import { PricingService } from './pricing.service';
import { RefundsService } from './refunds.service';
import { ReturnsService } from './returns.service';
import { SellerOrdersService } from './seller-orders.service';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [MarketplaceModule],
  controllers: [AddressesController, CartController, CheckoutController, OrdersController, PaymentsController, WishlistController, SellerCommerceController, AdminCommerceController],
  providers: [
    AddressesService,
    CartService,
    PricingService,
    OrdersService,
    SellerOrdersService,
    ReturnsService,
    RefundsService,
    PayoutsService,
    CouponsService,
    PaymentsService,
    BkashGateway,
    SslcommerzGateway,
    SandboxGateway,
    WishlistService,
  ],
  exports: [OrdersService, CartService, PayoutsService],
})
export class CommerceModule {}
