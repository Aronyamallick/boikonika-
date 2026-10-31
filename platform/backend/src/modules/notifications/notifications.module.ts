import { Global, Module } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { AdminNotificationsController, NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Global()
@Module({ controllers: [NotificationsController, AdminNotificationsController], providers: [NotificationsService, InboxService], exports: [NotificationsService] })
export class NotificationsModule {}
