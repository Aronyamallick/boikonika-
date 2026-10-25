import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { aiRequestSchema } from '@boikonika/shared';
import type { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { ZodBody } from '../../common/validation/zod';
import { AiService } from './ai.service';

@ApiTags('assistant')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Whether the reading and writing assistant is available, and how many requests are left today' })
  status(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.ai.status(user?.id);
  }

  @Post('assist')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ask the assistant: explain, summarise your own text, study questions, vocabulary, reading plans, grammar, improvements, ideas, outlines' })
  assist(@CurrentUser() user: AuthenticatedUser, @ZodBody(aiRequestSchema) body: z.output<typeof aiRequestSchema>) {
    return this.ai.assist(user.id, body);
  }
}
