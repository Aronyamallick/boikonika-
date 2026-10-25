import { Global, Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { HomeService } from './home.service';
import { RecommendationsService } from './recommendations.service';
import { SearchService } from './search.service';

@Global()
@Module({ controllers: [CatalogController], providers: [CatalogService, SearchService, HomeService, RecommendationsService], exports: [CatalogService, SearchService, HomeService, RecommendationsService] })
export class CatalogModule {}
