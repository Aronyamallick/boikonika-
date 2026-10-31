/** The optional reading and writing assistant. */

export const AI_BOOK_TASKS = ['explain', 'summarize', 'questions', 'vocabulary', 'reading_plan'] as const;
export const AI_WRITING_TASKS = ['grammar', 'improve', 'brainstorm', 'outline'] as const;
export const AI_TASKS = [...AI_BOOK_TASKS, ...AI_WRITING_TASKS] as const;
export type AiTask = (typeof AI_TASKS)[number];

/** Tasks that work on the reader's own text, which must be pasted in. */
export const AI_TEXT_TASKS = ['summarize', 'grammar', 'improve'] as const satisfies readonly AiTask[];
/** Summaries are only for text the reader owns or may use. */
export const AI_OWNERSHIP_TASKS = ['summarize'] as const satisfies readonly AiTask[];

export const AI_LEVELS = ['school', 'college', 'university', 'general'] as const;
export type AiLevel = (typeof AI_LEVELS)[number];

export const AI_MAX_INPUT = 12_000;
