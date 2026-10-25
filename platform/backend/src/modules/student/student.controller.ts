import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ACADEMIC_LEVELS,
  AUDIENCES,
  COMPETITION_STATUSES,
  competitionEntrySchema,
  competitionSchema,
  educationEventSchema,
  entryJudgementSchema,
  noteSchema,
  noteUpdateSchema,
  quizAttemptSchema,
  quizListQuerySchema,
  quizSchema,
  scholarshipSchema,
  STUDY_SUBJECTS,
} from '@boikonika/shared';
import { z } from 'zod';
import { CurrentUser, RequirePermissions, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { QuizzesService } from './quizzes.service';
import { StudyService } from './study.service';

type Me = AuthenticatedUser;
const notesQuery = z.object({ subject: z.enum(STUDY_SUBJECTS).optional() });
const eventsQuery = z.object({ audience: z.enum(AUDIENCES).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const scholarshipQuery = z.object({ level: z.enum(ACADEMIC_LEVELS).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const competitionQuery = z.object({ status: z.enum(COMPETITION_STATUSES).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const statusBody = z.object({ status: z.enum(['published', 'hidden']) });
const competitionStatusBody = z.object({ status: z.enum(COMPETITION_STATUSES) });

@ApiTags('student zone')
@Controller()
export class StudentController {
  constructor(
    private readonly quizzes: QuizzesService,
    private readonly study: StudyService,
  ) {}

  @Public()
  @Get('student-zone')
  @ApiOperation({ summary: 'Student Zone home: quizzes, events, competitions, scholarships, study groups, textbooks' })
  home(@CurrentUser() viewer?: Me) {
    return this.study.home(viewer?.id);
  }

  // quizzes
  @Public()
  @Get('quizzes')
  async quizList(@ZodQuery(quizListQuerySchema) q: z.output<typeof quizListQuerySchema>, @CurrentUser() viewer?: Me) {
    const { items, meta } = await this.quizzes.list(q, viewer?.id);
    return paginated(items, meta);
  }

  @Public()
  @Get('quizzes/:slug')
  quiz(@Param('slug') slug: string, @CurrentUser() viewer?: Me) {
    return this.quizzes.get(slug, viewer?.id);
  }

  @Post('quizzes/:slug/attempts')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit answers; returns the score and, now, the correct answers with explanations' })
  attempt(@CurrentUser() user: Me, @Param('slug') slug: string, @ZodBody(quizAttemptSchema) body: z.output<typeof quizAttemptSchema>) {
    return this.quizzes.attempt(user.id, slug, body);
  }

  @Post('quizzes')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Publish a quiz (teachers and Student Zone staff)' })
  async createQuiz(@CurrentUser() user: Me, @ZodBody(quizSchema) body: z.output<typeof quizSchema>) {
    return withMessage(await this.quizzes.create(user.id, body), t('api.student.quizCreated'));
  }

  @Get('me/quizzes')
  @ApiBearerAuth('access-token')
  myQuizzes(@CurrentUser() user: Me) {
    return this.quizzes.mine(user.id);
  }

  @Put('quizzes/:slug/status')
  @ApiBearerAuth('access-token')
  quizStatus(@CurrentUser() user: Me, @Param('slug') slug: string, @ZodBody(statusBody) body: z.output<typeof statusBody>) {
    return this.quizzes.setStatus(user.id, slug, body.status);
  }

  // notes
  @Get('me/notes')
  @ApiBearerAuth('access-token')
  notes(@CurrentUser() user: Me, @ZodQuery(notesQuery) q: z.output<typeof notesQuery>) {
    return this.study.notes(user.id, q.subject);
  }

  @Post('me/notes')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  async createNote(@CurrentUser() user: Me, @ZodBody(noteSchema) body: z.output<typeof noteSchema>) {
    return withMessage(await this.study.createNote(user.id, body), t('api.student.noteSaved'));
  }

  @Patch('me/notes/:id')
  @ApiBearerAuth('access-token')
  async updateNote(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(noteUpdateSchema) body: z.output<typeof noteUpdateSchema>) {
    return withMessage(await this.study.updateNote(user.id, id, body), t('api.student.noteSaved'));
  }

  @Delete('me/notes/:id')
  @ApiBearerAuth('access-token')
  async deleteNote(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.study.deleteNote(user.id, id);
    return withMessage(null, t('api.student.noteDeleted'));
  }

  @Public()
  @Get('notes/:id')
  sharedNote(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() viewer?: Me) {
    return this.study.sharedNote(id, viewer?.id);
  }

  // events, competitions, scholarships
  @Public()
  @Get('education-events')
  events(@ZodQuery(eventsQuery) q: z.output<typeof eventsQuery>) {
    return this.study.events({ upcoming: true, audience: q.audience, limit: q.limit });
  }

  @Public()
  @Get('competitions')
  competitionList(@ZodQuery(competitionQuery) q: z.output<typeof competitionQuery>) {
    return this.study.competitions({ status: q.status === 'draft' ? undefined : q.status, limit: q.limit });
  }

  @Public()
  @Get('competitions/:slug')
  competition(@Param('slug') slug: string, @CurrentUser() viewer?: Me) {
    return this.study.competition(slug, viewer?.id);
  }

  @Post('competitions/:slug/entries')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  async enter(@CurrentUser() user: Me, @Param('slug') slug: string, @ZodBody(competitionEntrySchema) body: z.output<typeof competitionEntrySchema>) {
    return withMessage(await this.study.enter(user.id, slug, body.postId), t('api.student.entered'));
  }

  @Public()
  @Get('scholarships')
  scholarships(@ZodQuery(scholarshipQuery) q: z.output<typeof scholarshipQuery>) {
    return this.study.scholarships({ level: q.level, limit: q.limit });
  }
}

/** Student Zone staff tools (events, competitions and judging, scholarships). */
@ApiTags('admin · student zone')
@ApiBearerAuth('access-token')
@Controller('admin/student')
export class AdminStudentController {
  constructor(private readonly study: StudyService) {}

  @Post('events')
  @HttpCode(201)
  @RequirePermissions('student.manage')
  async createEvent(@CurrentUser() user: Me, @ZodBody(educationEventSchema) body: z.output<typeof educationEventSchema>) {
    return withMessage(await this.study.createEvent(user.id, body), t('api.student.saved'));
  }

  @Delete('events/:id')
  @RequirePermissions('student.manage')
  async deleteEvent(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.study.deleteEvent(user.id, id);
    return withMessage(null, t('api.student.deleted'));
  }

  @Get('competitions')
  @RequirePermissions('student.manage')
  competitions() {
    return this.study.competitions({ limit: 100, includeDrafts: true });
  }

  @Post('competitions')
  @HttpCode(201)
  @RequirePermissions('student.manage')
  async createCompetition(@CurrentUser() user: Me, @ZodBody(competitionSchema) body: z.output<typeof competitionSchema>) {
    return withMessage(await this.study.createCompetition(user.id, body), t('api.student.saved'));
  }

  @Put('competitions/:slug/status')
  @RequirePermissions('student.manage')
  competitionStatus(@CurrentUser() user: Me, @Param('slug') slug: string, @ZodBody(competitionStatusBody) body: z.output<typeof competitionStatusBody>) {
    return this.study.setCompetitionStatus(user.id, slug, body.status);
  }

  @Get('competitions/:slug/entries')
  @RequirePermissions('student.manage')
  entries(@Param('slug') slug: string) {
    return this.study.entries(slug);
  }

  @Put('entries/:id')
  @RequirePermissions('student.manage')
  judge(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string, @ZodBody(entryJudgementSchema) body: z.output<typeof entryJudgementSchema>) {
    return this.study.judge(user.id, id, body);
  }

  @Post('scholarships')
  @HttpCode(201)
  @RequirePermissions('student.manage')
  async createScholarship(@CurrentUser() user: Me, @ZodBody(scholarshipSchema) body: z.output<typeof scholarshipSchema>) {
    return withMessage(await this.study.createScholarship(user.id, body), t('api.student.saved'));
  }

  @Delete('scholarships/:id')
  @RequirePermissions('student.manage')
  async deleteScholarship(@CurrentUser() user: Me, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.study.deleteScholarship(user.id, id);
    return withMessage(null, t('api.student.deleted'));
  }
}
