import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_BOOK_TASKS, AI_WRITING_TASKS, type aiRequestSchema } from '@boikonika/shared';
import { aiUsage, type Database } from '@boikonika/database';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { AppException } from '../../common/errors/app-exception';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';
import { SettingsService } from '../settings/settings.service';
import { buildRequest, SYSTEM_PROMPT, type BookContext } from './prompts';

type Request = z.output<typeof aiRequestSchema>;
type Row = Record<string, unknown>;
const DEFAULT_DAILY = 20;
/** One request per person at a time; the lock outlives the slowest answer. */
const LOCK_SECONDS = 180;
const MAX_TOKENS = 16_000;

/**
 * The optional reading and writing assistant, backed by Claude. Without ANTHROPIC_API_KEY it reports
 * itself unavailable and never answers. Requests and answers are not stored; only token counts and
 * outcomes are recorded (ai_usage) for the daily limit and cost monitoring.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  /** Null when no key is configured. Exposed to tests so the provider call can be replaced. */
  readonly client: Anthropic | null;
  readonly model: string;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly settings: SettingsService,
  ) {
    this.client = config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 }) : null;
    this.model = config.AI_MODEL;
  }

  async status(userId?: string) {
    const limit = await this.settings.number('ai.dailyRequests', DEFAULT_DAILY);
    const enabled = !!this.client && limit > 0;
    const used = enabled && userId ? await this.usedToday(userId) : 0;
    return { enabled, bookTasks: AI_BOOK_TASKS, writingTasks: AI_WRITING_TASKS, dailyLimit: limit, usedToday: used, remainingToday: Math.max(0, limit - used) };
  }

  /** Answered and declined requests count towards the day; provider failures don't. */
  private async usedToday(userId: string): Promise<number> {
    const [r] = await this.db
      .execute<{ n: number }>(sql`
        select count(*)::int as n from ai_usage
        where user_id = ${userId} and status in ('ok', 'declined')
          and created_at >= (date_trunc('day', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka')`)
      .then((x) => x.rows);
    return r?.n ?? 0;
  }

  private async book(id: string): Promise<BookContext> {
    const [b] = await this.db
      .execute<Row>(sql`
        select b.title, b.description, b.language, b.first_published_year,
          array(select a.name from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = b.id order by ba.position) as authors,
          array(select c.name->>'en' from book_categories bc join categories c on c.id = bc.category_id where bc.book_id = b.id) as categories,
          (select max(f.pages) from book_formats f where f.book_id = b.id) as pages
        from books b where b.id = ${id} and b.status = 'published' and b.deleted_at is null`)
      .then((x) => x.rows);
    if (!b) throw AppException.notFound('Book');
    return {
      title: b.title as string,
      authors: (b.authors as string[]) ?? [],
      categories: ((b.categories as Array<string | null>) ?? []).filter((c): c is string => !!c),
      language: (b.language as string | null) ?? null,
      pages: b.pages ? Number(b.pages) : null,
      year: b.first_published_year ? Number(b.first_published_year) : null,
      description: (b.description as string | null) ?? null,
    };
  }

  async assist(userId: string, req: Request) {
    if (!this.client) throw new AppException('SERVICE_UNAVAILABLE', 'api.ai.unavailable');
    const limit = await this.settings.number('ai.dailyRequests', DEFAULT_DAILY);
    if (limit <= 0) throw new AppException('SERVICE_UNAVAILABLE', 'api.ai.unavailable');
    if ((await this.usedToday(userId)) >= limit) throw new AppException('RATE_LIMITED', 'api.ai.dailyLimit').withParams({ limit });
    const book = req.bookId ? await this.book(req.bookId) : null;

    const lock = `ai:busy:${userId}`;
    if (!(await this.redis.set(lock, '1', 'EX', LOCK_SECONDS, 'NX'))) throw new AppException('CONFLICT', 'api.ai.inProgress');
    const started = Date.now();
    try {
      const message = await this.client.beta.messages
        .stream({
          model: this.model,
          max_tokens: MAX_TOKENS,
          // Stable instructions first, marked for the prompt cache; the request itself follows.
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: buildRequest(req, book) }],
          output_config: { effort: 'medium' },
          // If a safety classifier declines, the API retries on the model Anthropic recommends for that case.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          metadata: { user_id: userId },
        })
        .finalMessage();

      const usage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      };
      // A refusal can arrive with partial or no content; never show it as an answer.
      if (message.stop_reason === 'refusal') {
        await this.record(userId, req.task, message.model, 'declined', usage, started);
        throw new AppException('BAD_REQUEST', 'api.ai.declined');
      }
      const output = message.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n\n')
        .trim();
      await this.record(userId, req.task, message.model, 'ok', usage, started);
      const used = await this.usedToday(userId);
      return { task: req.task, output, truncated: message.stop_reason === 'max_tokens', remainingToday: Math.max(0, limit - used) };
    } catch (error) {
      if (error instanceof AppException) throw error;
      await this.record(userId, req.task, this.model, 'failed', null, started).catch(() => undefined);
      throw this.providerError(error);
    } finally {
      await this.redis.del(lock).catch(() => undefined);
    }
  }

  /** Maps provider errors to messages the reader can act on; configuration problems are logged for staff. */
  private providerError(error: unknown): AppException {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      this.logger.error(`AI provider rejected the credentials (${error.status}); check ANTHROPIC_API_KEY`);
      return new AppException('SERVICE_UNAVAILABLE', 'api.ai.unavailable');
    }
    if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.NotFoundError) {
      this.logger.error(`AI request rejected (${error.status}): ${error.message.slice(0, 300)}`);
      return new AppException('SERVICE_UNAVAILABLE', 'api.ai.failed');
    }
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIConnectionError) {
      this.logger.warn(`AI provider busy or unreachable: ${error.message.slice(0, 200)}`);
      return new AppException('SERVICE_UNAVAILABLE', 'api.ai.busy');
    }
    if (error instanceof Anthropic.APIError) {
      this.logger.error(`AI provider error (${error.status}): ${error.message.slice(0, 300)}`);
      return new AppException('SERVICE_UNAVAILABLE', 'api.ai.failed');
    }
    this.logger.error(`AI request failed: ${error instanceof Error ? error.message : String(error)}`);
    return new AppException('SERVICE_UNAVAILABLE', 'api.ai.failed');
  }

  private async record(userId: string, feature: string, model: string, status: 'ok' | 'declined' | 'failed', usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } | null, started: number) {
    await this.db.insert(aiUsage).values({ userId, feature, model: model.slice(0, 60), status, ...(usage ?? {}), durationMs: Date.now() - started });
  }
}
