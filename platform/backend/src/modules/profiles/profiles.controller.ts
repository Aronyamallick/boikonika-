import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { deleteAccountSchema, interestsSchema, updateProfileSchema } from '@boikonika/shared';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { AuthThrottle } from '../../common/decorators/throttle.decorators';
import { AppException } from '../../common/errors/app-exception';
import { t } from '../../common/i18n';
import { withMessage } from '../../common/http/response';
import { pageQuery } from '../../common/util/pagination';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { SessionsService } from '../auth/sessions.service';
import { AccountDataService } from './account-data.service';
import { ProfilesService } from './profiles.service';

const imageUpload = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const fileBody = { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } };

/** The signed-in user's own profile, preferences and account. */
@ApiTags('me')
@ApiBearerAuth('access-token')
@Controller('me')
export class MeController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly accountData: AccountDataService,
    private readonly sessions: SessionsService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Own profile, privacy settings and interests' })
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getOwn(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update profile details, privacy, language, theme and personalisation' })
  async update(@CurrentUser() user: AuthenticatedUser, @ZodBody(updateProfileSchema) body: z.output<typeof updateProfileSchema>) {
    return withMessage(await this.profiles.update(user.id, body), t('common.saved'));
  }

  @Put('avatar')
  @UseInterceptors(imageUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @ApiOperation({ summary: 'Upload a profile photo (JPEG, PNG or WebP, max 5 MB; cropped to a square, metadata removed)' })
  avatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw AppException.validation([{ field: 'file', code: 'required', message: 'validation.required' }]);
    return this.profiles.setImage(user.id, 'avatar', file.buffer);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Remove the profile photo' })
  async removeAvatar(@CurrentUser() user: AuthenticatedUser) {
    await this.profiles.removeImage(user.id, 'avatar');
    return null;
  }

  @Put('cover')
  @UseInterceptors(imageUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @ApiOperation({ summary: 'Upload a profile cover image' })
  cover(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw AppException.validation([{ field: 'file', code: 'required', message: 'validation.required' }]);
    return this.profiles.setImage(user.id, 'cover', file.buffer);
  }

  @Delete('cover')
  @ApiOperation({ summary: 'Remove the cover image' })
  async removeCover(@CurrentUser() user: AuthenticatedUser) {
    await this.profiles.removeImage(user.id, 'cover');
    return null;
  }

  @Put('interests')
  @ApiOperation({ summary: 'Set reading interests (onboarding, at least 3); used for recommendations' })
  interests(@CurrentUser() user: AuthenticatedUser, @ZodBody(interestsSchema) body: z.output<typeof interestsSchema>) {
    return this.profiles.setInterests(user.id, body.interests);
  }

  @Get('export')
  @ApiOperation({ summary: 'Download a copy of my personal data (JSON)' })
  async export(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const data = await this.accountData.export(user.id);
    res.setHeader('Content-Disposition', `attachment; filename="boikonika-data-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  }

  @Post('delete')
  @HttpCode(200)
  @AuthThrottle()
  @ApiOperation({ summary: 'Delete my account (password required when the account has one)' })
  async delete(@CurrentUser() user: AuthenticatedUser, @ZodBody(deleteAccountSchema) body: z.output<typeof deleteAccountSchema>, @Res({ passthrough: true }) res: Response) {
    await this.profiles.deleteAccount(user.id, body.password);
    this.sessions.clearRefreshCookie(res);
    return null;
  }
}

/** Public profiles, follows and blocks. */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly profiles: ProfilesService) {}

  @Public()
  @Get(':username')
  @ApiOperation({ summary: 'Public profile (fields hidden according to the owner’s privacy settings)' })
  profile(@Param('username') username: string, @CurrentUser() viewer?: AuthenticatedUser) {
    return this.profiles.publicProfile(username, viewer?.id);
  }

  @Public()
  @Get(':username/followers')
  @ApiOperation({ summary: 'Followers of a user' })
  followers(@Param('username') username: string, @ZodQuery(pageQuery) q: z.output<typeof pageQuery>, @CurrentUser() viewer?: AuthenticatedUser) {
    return this.profiles.followers(username, viewer?.id, 'followers', q.pageSize, (q.page - 1) * q.pageSize);
  }

  @Public()
  @Get(':username/following')
  @ApiOperation({ summary: 'Users this user follows' })
  following(@Param('username') username: string, @ZodQuery(pageQuery) q: z.output<typeof pageQuery>, @CurrentUser() viewer?: AuthenticatedUser) {
    return this.profiles.followers(username, viewer?.id, 'following', q.pageSize, (q.page - 1) * q.pageSize);
  }

  @Post(':username/follow')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  follow(@CurrentUser() viewer: AuthenticatedUser, @Param('username') username: string) {
    return this.profiles.follow(viewer.id, username);
  }

  @Delete(':username/follow')
  @ApiBearerAuth('access-token')
  unfollow(@CurrentUser() viewer: AuthenticatedUser, @Param('username') username: string) {
    return this.profiles.unfollow(viewer.id, username);
  }

  @Post(':username/block')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  async block(@CurrentUser() viewer: AuthenticatedUser, @Param('username') username: string) {
    await this.profiles.block(viewer.id, username);
    return { blocked: true };
  }

  @Delete(':username/block')
  @ApiBearerAuth('access-token')
  async unblock(@CurrentUser() viewer: AuthenticatedUser, @Param('username') username: string) {
    await this.profiles.unblock(viewer.id, username);
    return { blocked: false };
  }
}
