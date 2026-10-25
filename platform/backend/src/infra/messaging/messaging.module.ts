import { Global, Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { OutboxService } from './outbox.service';
import { PushService } from './push.service';

@Global()
@Module({ providers: [OutboxService, MessagesService, PushService], exports: [OutboxService, MessagesService, PushService] })
export class MessagingModule {}
