import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { QuizzesService } from './quizzes.service';
import { AdminStudentController, StudentController } from './student.controller';
import { StudyService } from './study.service';

@Module({ imports: [CatalogModule], controllers: [StudentController, AdminStudentController], providers: [QuizzesService, StudyService] })
export class StudentModule {}
