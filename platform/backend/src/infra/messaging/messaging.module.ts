import { Global, Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { OutboxService } from './outbox.service';

@Global()
@Module({ providers: [OutboxService, MessagesService], exports: [OutboxService, MessagesService] })
export class MessagingModule {}
