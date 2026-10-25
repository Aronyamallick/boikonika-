import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { articleListQuerySchema, BANNER_PLACEMENTS, contactMessageSchema } from '@boikonika/shared';
import { z } from 'zod';
import { requestContext } from '../../common/context/request-context';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { t } from '../../common/i18n';
import { paginated, withMessage } from '../../common/http/response';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { CmsService } from './cms.service';
import { ContactService } from './contact.service';

const helpQuery = z.object({ q: z.string().trim().min(2).max(120) });
const bannerQuery = z.object({ placement: z.enum(BANNER_PLACEMENTS).default('home') });

@ApiTags('content')
@Controller()
export class CmsController {
  constructor(
    private readonly cms: CmsService,
    private readonly contact: ContactService,
  ) {}

  @Public()
  @Get('pages')
  @ApiOperation({ summary: 'Published information pages (slug, title, last change)' })
  pages() {
    return this.cms.pages();
  }

  @Public()
  @Get('pages/:slug')
  @ApiOperation({ summary: 'An information page (about, terms, privacy, policies) in both languages, as Markdown' })
  page(@Param('slug') slug: string) {
    return this.cms.page(slug);
  }

  @Public()
  @Get('faqs')
  @ApiOperation({ summary: 'Published FAQs by category' })
  faqs() {
    return this.cms.faqs();
  }

  @Public()
  @Get('help/search')
  @ApiOperation({ summary: 'Search FAQs and help articles' })
  helpSearch(@ZodQuery(helpQuery) q: { q: string }) {
    return this.cms.helpSearch(q.q);
  }

  @Public()
  @Get('articles')
  @ApiOperation({ summary: 'Published articles: blog, learning, announcements, study resources or help' })
  async articles(@ZodQuery(articleListQuerySchema) q: z.output<typeof articleListQuerySchema>) {
    const { items, meta } = await this.cms.articles(q);
    return paginated(items, meta);
  }

  @Public()
  @Get('articles/:slug')
  @ApiOperation({ summary: 'An article with related reading' })
  article(@CurrentUser() user: AuthenticatedUser | undefined, @Param('slug') slug: string) {
    return this.cms.article(slug, user?.id ?? requestContext.get()?.ip ?? undefined);
  }

  @Public()
  @Get('banners')
  @ApiOperation({ summary: 'Banners currently running in a placement' })
  banners(@ZodQuery(bannerQuery) q: { placement: string }) {
    return this.cms.banners(q.placement);
  }

  @Public()
  @Post('contact')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send a message to the Boikonika team (guests leave an email for the reply)' })
  async send(@CurrentUser() user: AuthenticatedUser | undefined, @ZodBody(contactMessageSchema) body: z.output<typeof contactMessageSchema>) {
    const ctx = requestContext.get();
    return withMessage(await this.contact.submit(body, { userId: user?.id, ip: ctx?.ip ?? undefined, locale: ctx?.locale === 'en' ? 'en' : 'bn' }), t('api.contact.received'));
  }
}
