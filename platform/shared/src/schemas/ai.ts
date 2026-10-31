import { z } from 'zod';
import { AI_LEVELS, AI_MAX_INPUT, AI_OWNERSHIP_TASKS, AI_TASKS, AI_TEXT_TASKS } from '../constants/ai';
import { LOCALES } from '../i18n/locales';
import { multilineText } from './cms';

/** One request to the assistant. Book context is looked up from `bookId`; nothing is stored. */
export const aiRequestSchema = z
  .object({
    task: z.enum(AI_TASKS, { error: 'validation.invalidChoice' }),
    input: multilineText(0, AI_MAX_INPUT).default(''),
    bookId: z.uuid().optional(),
    /** The language to answer in. */
    language: z.enum(LOCALES),
    level: z.enum(AI_LEVELS).default('general'),
    count: z.coerce.number().int().min(3).max(15).default(8),
    days: z.coerce.number().int().min(1).max(90).default(14),
    minutesPerDay: z.coerce.number().int().min(5).max(240).default(30),
    ownText: z.boolean().default(false),
  })
  .refine((v) => !(AI_TEXT_TASKS as readonly string[]).includes(v.task) || v.input.length >= 20, { error: 'validation.tooShort', path: ['input'] })
  .refine((v) => (AI_TEXT_TASKS as readonly string[]).includes(v.task) || v.input.length >= 2 || !!v.bookId, { error: 'validation.required', path: ['input'] })
  .refine((v) => !(AI_OWNERSHIP_TASKS as readonly string[]).includes(v.task) || v.ownText, { error: 'validation.declaration', path: ['ownText'] });
export type AiRequestInput = z.input<typeof aiRequestSchema>;
