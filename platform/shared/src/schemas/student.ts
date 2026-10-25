import { z } from 'zod';
import { STUDY_SUBJECTS } from '../constants/community';
import { ACADEMIC_LEVELS } from '../constants/interests';
import { VISIBILITIES } from '../constants/statuses';
import { nfcText } from './catalog';

const text = (min: number, max: number) =>
  z
    .string({ error: 'validation.required' })
    .max(max * 2)
    .transform((v) => v.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim())
    .pipe(z.string().min(min, { error: min ? 'validation.required' : 'validation.tooShort' }).max(max, { error: 'validation.maxLength' }));
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\/[^\s]+\.[^\s]+$/.test(v), { error: 'validation.httpsUrl' })
  .transform((v) => v || null);

export const AUDIENCES = ['all', 'student', 'teacher', 'parent', 'seller', 'author'] as const;
export const COMPETITION_KINDS = ['writing', 'book_review', 'poetry', 'quiz'] as const;
export const COMPETITION_STATUSES = ['draft', 'open', 'judging', 'closed'] as const;
export const QUIZ_LANGUAGES = ['bn', 'en'] as const;

export const quizQuestionSchema = z
  .object({
    prompt: text(3, 1000),
    options: z.array(nfcText(1, 300)).min(2, { error: 'validation.quizOptions' }).max(6, { error: 'validation.quizOptions' }),
    correctIndex: z.coerce.number().int().min(0),
    explanation: text(0, 1000).optional(),
  })
  .refine((q) => q.correctIndex < q.options.length, { error: 'validation.correctAnswer', path: ['correctIndex'] })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, { error: 'validation.duplicateOptions', path: ['options'] });

export const quizSchema = z.object({
  title: nfcText(3, 200),
  description: text(0, 2000).optional(),
  subject: z.enum(STUDY_SUBJECTS, { error: 'validation.invalidChoice' }),
  academicLevel: z.enum(ACADEMIC_LEVELS).default('general'),
  language: z.enum(QUIZ_LANGUAGES).default('bn'),
  bookId: z.uuid().optional(),
  timeLimitSeconds: z.coerce.number().int().min(60).max(7200).optional(),
  passPercent: z.coerce.number().int().min(1).max(100).default(60),
  questions: z.array(quizQuestionSchema).min(1, { error: 'validation.quizQuestions' }).max(50, { error: 'validation.quizQuestions' }),
});

export const quizListQuerySchema = z.object({
  subject: z.enum(STUDY_SUBJECTS).optional(),
  level: z.enum(ACADEMIC_LEVELS).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(200).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(18),
});

/** Answers in question order; -1 for a question left blank. */
export const quizAttemptSchema = z.object({
  answers: z.array(z.number().int().min(-1).max(5)).max(50),
  startedAt: z.iso.datetime({ offset: true }),
});

export const noteSchema = z.object({
  title: nfcText(1, 200),
  body: text(1, 20000),
  subject: z.enum(STUDY_SUBJECTS).optional(),
  bookId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(20000).optional(),
  visibility: z.enum(VISIBILITIES).default('private'),
});
export const noteUpdateSchema = noteSchema.partial();

export const educationEventSchema = z
  .object({
    title: nfcText(3, 200),
    description: text(0, 4000).optional(),
    audience: z.enum(AUDIENCES).default('student'),
    startsAt: z.iso.datetime({ offset: true, error: 'validation.dateTime' }),
    endsAt: z.iso.datetime({ offset: true, error: 'validation.dateTime' }).optional(),
    location: nfcText(0, 200).optional(),
    onlineUrl: httpsUrl.optional(),
    organizer: nfcText(0, 200).optional(),
  })
  .refine((v) => !v.endsAt || Date.parse(v.endsAt) > Date.parse(v.startsAt), { error: 'validation.dateRange', path: ['endsAt'] });

export const competitionSchema = z
  .object({
    title: nfcText(3, 200),
    kind: z.enum(COMPETITION_KINDS),
    rules: text(10, 8000),
    prizes: text(0, 2000).optional(),
    audience: z.enum(AUDIENCES).default('student'),
    startsAt: z.iso.datetime({ offset: true, error: 'validation.dateTime' }),
    endsAt: z.iso.datetime({ offset: true, error: 'validation.dateTime' }),
    status: z.enum(COMPETITION_STATUSES).default('draft'),
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), { error: 'validation.dateRange', path: ['endsAt'] });
export const competitionEntrySchema = z.object({ postId: z.uuid() });
export const entryJudgementSchema = z.object({ status: z.enum(['submitted', 'shortlisted', 'winner', 'disqualified']), score: z.coerce.number().int().min(0).max(100).optional(), note: text(0, 1000).optional() });

export const scholarshipSchema = z.object({
  title: nfcText(3, 200),
  provider: nfcText(2, 200),
  description: text(10, 8000),
  eligibility: text(0, 4000).optional(),
  amountText: nfcText(0, 120).optional(),
  academicLevel: z.enum(ACADEMIC_LEVELS).optional(),
  deadline: z.iso.date({ error: 'validation.date' }).optional(),
  applyUrl: httpsUrl.optional(),
});
