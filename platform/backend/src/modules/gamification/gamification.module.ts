import { Global, Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';

/** XP, levels and badges — used by community, reviews, reading, quizzes and clubs. */
@Global()
@Module({ providers: [GamificationService], exports: [GamificationService] })
export class GamificationModule {}
