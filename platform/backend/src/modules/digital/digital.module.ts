import { Module } from '@nestjs/common';
import { AdminDigitalController, DigitalController } from './digital.controller';
import { DigitalService } from './digital.service';

@Module({ controllers: [DigitalController, AdminDigitalController], providers: [DigitalService], exports: [DigitalService] })
export class DigitalModule {}
