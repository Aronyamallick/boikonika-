import { z } from 'zod';
import { CLUB_PURPOSES, JOIN_POLICIES, MAX_POLL_OPTIONS, MEMBER_ACTIONS, STUDY_SUBJECTS } from '../constants/community';
import { CLUB_TYPES } from '../constants/statuses';
import { nfcText } from './catalog';

const text = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((v) => v.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim())
    .pipe(z.string().max(max, { error: 'validation.maxLength' }));
const required = (max: number) => text(max).pipe(z.string().min(1, { error: 'validation.required' }));
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\/[^\s]+\.[^\s]+$/.test(v), { error: 'validation.httpsUrl' })
  .transform((v) => v || null);

const clubFields = {
  name: nfcText(3, 160),
  description: text(2000).optional(),
  type: z.enum(CLUB_TYPES).default('public'),
  purpose: z.enum(CLUB_PURPOSES).default('reading'),
  subject: z.enum(STUDY_SUBJECTS, { error: 'validation.invalidChoice' }).optional(),
  institutionName: nfcText(0, 200).optional(),
  joinPolicy: z.enum(JOIN_POLICIES).default('open'),
  rules: text(3000).optional(),
};

function clubRules(v: { type?: string; purpose?: string; subject?: string; institutionName?: string; joinPolicy?: string }, ctx: z.RefinementCtx) {
  if (v.purpose === 'study' && !v.subject) ctx.addIssue({ code: 'custom', path: ['subject'], message: 'validation.required' });
  if (v.type && ['school', 'college', 'university'].includes(v.type) && !v.institutionName) ctx.addIssue({ code: 'custom', path: ['institutionName'], message: 'validation.required' });
  // Private clubs can't be joined freely.
  if (v.type === 'private' && v.joinPolicy === 'open') ctx.addIssue({ code: 'custom', path: ['joinPolicy'], message: 'validation.privateClubPolicy' });
}

export const clubSchema = z.object(clubFields).superRefine(clubRules);
export const clubUpdateSchema = z
  .object({ ...clubFields, type: z.enum(CLUB_TYPES).optional(), purpose: z.enum(CLUB_PURPOSES).optional(), joinPolicy: z.enum(JOIN_POLICIES).optional(), name: nfcText(3, 160).optional() })
  .superRefine(clubRules);

export const clubListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(CLUB_TYPES).optional(),
  purpose: z.enum(CLUB_PURPOSES).optional(),
  subject: z.enum(STUDY_SUBJECTS).optional(),
  mine: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).max(200).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(18),
});

export const clubPostSchema = z.object({
  title: nfcText(0, 200).optional(),
  body: required(5000),
  kind: z.enum(['discussion', 'announcement']).default('discussion'),
  parentId: z.uuid().optional(),
});

export const clubEventSchema = z
  .object({
    title: nfcText(3, 200),
    description: text(2000).optional(),
    startsAt: z.iso.datetime({ offset: true, error: 'validation.dateTime' }),
    endsAt: z.iso.datetime({ offset: true, error: 'validation.dateTime' }).optional(),
    location: nfcText(0, 200).optional(),
    onlineUrl: httpsUrl.optional(),
  })
  .refine((v) => Date.parse(v.startsAt) > Date.now() - 3_600_000, { error: 'validation.futureDate', path: ['startsAt'] })
  .refine((v) => !v.endsAt || Date.parse(v.endsAt) > Date.parse(v.startsAt), { error: 'validation.dateRange', path: ['endsAt'] });

export const clubBookSchema = z.object({
  bookId: z.uuid({ error: 'validation.bookRequired' }),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'validation.month' }),
  status: z.enum(['upcoming', 'current', 'finished']).default('current'),
});

export const scheduleItemSchema = z
  .object({
    title: nfcText(2, 200),
    fromPage: z.coerce.number().int().min(1).max(20000).optional(),
    toPage: z.coerce.number().int().min(1).max(20000).optional(),
    dueOn: z.iso.date({ error: 'validation.date' }),
  })
  .refine((v) => !v.fromPage || !v.toPage || v.toPage >= v.fromPage, { error: 'validation.pageRange', path: ['toPage'] });

export const pollSchema = z.object({
  question: nfcText(3, 300),
  options: z
    .array(z.object({ label: nfcText(1, 200), bookId: z.uuid().optional() }))
    .min(2, { error: 'validation.pollOptions' })
    .max(MAX_POLL_OPTIONS, { error: 'validation.pollOptions' }),
  allowMultiple: z.boolean().default(false),
  closesAt: z.iso.datetime({ offset: true }).optional(),
});
export const pollVoteSchema = z.object({ optionIds: z.array(z.uuid()).min(1).max(MAX_POLL_OPTIONS) });

export const clubInviteSchema = z.object({ username: z.string().trim().toLowerCase().min(3).max(30) });
export const memberActionSchema = z.object({ action: z.enum(MEMBER_ACTIONS) });
