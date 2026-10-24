import { Global, Module } from '@nestjs/common';
import { AccountDataService } from './account-data.service';
import { MeController, UsersController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Global()
@Module({ controllers: [MeController, UsersController], providers: [ProfilesService, AccountDataService], exports: [ProfilesService, AccountDataService] })
export class ProfilesModule {}
