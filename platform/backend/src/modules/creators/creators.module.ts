import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AuthorService } from './author.service';
import { AdminAuthorClaimsController, AuthorController, PublisherController, SellerDashboardController } from './creators.controller';
import { PublisherService } from './publisher.service';
import { SellerDashboardService } from './seller-dashboard.service';

@Module({
  imports: [MarketplaceModule, CommerceModule, ReviewsModule],
  controllers: [SellerDashboardController, AuthorController, PublisherController, AdminAuthorClaimsController],
  providers: [SellerDashboardService, AuthorService, PublisherService],
})
export class CreatorsModule {}
