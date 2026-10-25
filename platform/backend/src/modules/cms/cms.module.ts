import { Module } from '@nestjs/common';
import { CmsAdminController } from './cms-admin.controller';
import { CmsAdminService } from './cms-admin.service';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { ContactService } from './contact.service';

@Module({ controllers: [CmsController, CmsAdminController], providers: [CmsService, CmsAdminService, ContactService], exports: [CmsService, ContactService] })
export class CmsModule {}
