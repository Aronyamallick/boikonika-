import { Global, Module } from '@nestjs/common';
import { AdminKycController, KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Global()
@Module({ controllers: [KycController, AdminKycController], providers: [KycService], exports: [KycService] })
export class KycModule {}
