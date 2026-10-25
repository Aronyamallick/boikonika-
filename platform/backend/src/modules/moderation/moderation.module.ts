import { Module } from '@nestjs/common';
import { ReportsController } from './moderation.controller';
import { ReportsService } from './reports.service';

@Module({ controllers: [ReportsController], providers: [ReportsService], exports: [ReportsService] })
export class ModerationModule {}
