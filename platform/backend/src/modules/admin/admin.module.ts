import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [ModerationModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
