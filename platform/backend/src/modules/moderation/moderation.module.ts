import { Module } from '@nestjs/common';
import { DigitalModule } from '../digital/digital.module';
import { CopyrightService } from './copyright.service';
import { AdminModerationController, CopyrightController } from './moderation-admin.controller';
import { ModerationAdminService } from './moderation-admin.service';
import { ReportsController } from './moderation.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [DigitalModule],
  controllers: [ReportsController, AdminModerationController, CopyrightController],
  providers: [ReportsService, ModerationAdminService, CopyrightService],
  exports: [ReportsService, ModerationAdminService, CopyrightService],
})
export class ModerationModule {}
