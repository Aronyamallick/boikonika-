import { Module } from '@nestjs/common';
import { CommunityController } from './community.controller';
import { EngagementService } from './engagement.service';
import { PostsService } from './posts.service';

@Module({ controllers: [CommunityController], providers: [PostsService, EngagementService], exports: [PostsService] })
export class CommunityModule {}
