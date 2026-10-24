import { Global, Module } from '@nestjs/common';
import { AdminProductsService } from './admin-products.service';
import { AdminProductsController, SellerController } from './marketplace.controller';
import { SellerProductsService } from './seller-products.service';
import { SellersService } from './sellers.service';

@Global()
@Module({ controllers: [SellerController, AdminProductsController], providers: [SellersService, SellerProductsService, AdminProductsService], exports: [SellersService, SellerProductsService] })
export class MarketplaceModule {}
