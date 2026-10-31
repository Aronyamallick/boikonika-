import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { ChallengesController, ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';

@Module({ controllers: [ReadingController, ChallengesController], providers: [ReadingService, ChallengesService], exports: [ReadingService, ChallengesService] })
export class ReadingModule {}
