import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { changePasswordSchema, contactSchema, logoutAllSchema, otpCodeSchema, twoFactorDisableSchema, twoFactorEnableSchema, verifyContactSchema } from '@boikonika/shared';
import { z } from 'zod';
import { requestContext } from '../../common/context/request-context';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AuthThrottle } from '../../common/decorators/throttle.decorators';
import { t } from '../../common/i18n';
import { withMessage } from '../../common/http/response';
import { ZodBody } from '../../common/validation/zod';
import { AuthService } from './auth.service';

/** Password, devices, login history, two-step verification and verified contacts of the signed-in user. */
@ApiTags('account security')
@ApiBearerAuth('access-token')
@Controller('account/security')
export class AccountSecurityController {
  constructor(private readonly auth: AuthService) {}

  @Post('password')
  @HttpCode(200)
  @AuthThrottle()
  @ApiOperation({ summary: 'Change password (optionally signing out other devices)' })
  async changePassword(@CurrentUser() user: AuthenticatedUser, @ZodBody(changePasswordSchema) body: z.output<typeof changePasswordSchema>) {
    await this.auth.changePassword(user.id, user.sessionId, body.currentPassword, body.newPassword, body.signOutOtherDevices);
    return withMessage(null, t('api.auth.passwordChanged'));
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Active devices' })
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Sign out one device' })
  async revoke(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.auth.revokeSession(user.id, id);
    return withMessage(null, t('api.auth.loggedOut'));
  }

  @Post('logout-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign out of all devices (optionally keeping this one)' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @ZodBody(logoutAllSchema) body: z.output<typeof logoutAllSchema>) {
    const revoked = await this.auth.logoutAll(user.id, user.sessionId, body.keepCurrent);
    return withMessage({ revoked }, t('api.auth.loggedOutAll'));
  }

  @Get('login-history')
  @ApiOperation({ summary: 'Recent sign-in attempts on this account' })
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.loginHistory(user.id);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start two-step verification setup (secret + QR code, valid 10 minutes)' })
  setupTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.startTwoFactorSetup(user.id);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @AuthThrottle()
  @ApiOperation({ summary: 'Confirm setup with a code from the authenticator app; returns one-time recovery codes' })
  enableTwoFactor(@CurrentUser() user: AuthenticatedUser, @ZodBody(twoFactorEnableSchema) body: z.output<typeof twoFactorEnableSchema>) {
    return this.auth.enableTwoFactor(user.id, user.sessionId, body.code);
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @AuthThrottle()
  @ApiOperation({ summary: 'Turn off two-step verification (password + current code)' })
  async disableTwoFactor(@CurrentUser() user: AuthenticatedUser, @ZodBody(twoFactorDisableSchema) body: z.output<typeof twoFactorDisableSchema>) {
    await this.auth.disableTwoFactor(user.id, body.password, body.code);
    return withMessage(null, t('api.messages.twoFactorDisabledTitle'));
  }

  @Post('2fa/recovery-codes')
  @HttpCode(200)
  @AuthThrottle()
  @ApiOperation({ summary: 'Replace the recovery codes (needs a current authenticator code)' })
  recoveryCodes(@CurrentUser() user: AuthenticatedUser, @ZodBody(z.object({ code: otpCodeSchema })) body: { code: string }) {
    return this.auth.regenerateRecoveryCodes(user.id, body.code);
  }

  @Post('contact/request')
  @HttpCode(200)
  @AuthThrottle()
  @ApiOperation({ summary: 'Send a code to a new email or phone number to add it to the account' })
  async requestContact(@CurrentUser() user: AuthenticatedUser, @ZodBody(z.object({ target: contactSchema })) body: { target: { kind: 'email' | 'phone'; value: string } }) {
    const purpose = body.target.kind === 'email' ? 'verify_email' : 'verify_phone';
    const result = await this.auth.requestOtp(body.target, purpose, requestContext.locale(), user.id);
    return withMessage(result, t('api.auth.otpSent', { target: result.sentTo }));
  }

  @Post('contact/verify')
  @HttpCode(200)
  @AuthThrottle()
  @ApiOperation({ summary: 'Confirm the code and save the verified email or phone number' })
  async verifyContact(@CurrentUser() user: AuthenticatedUser, @ZodBody(verifyContactSchema) body: z.output<typeof verifyContactSchema>) {
    return withMessage(await this.auth.verifyContact(user.id, body.target, body.code), t('api.auth.contactAdded'));
  }
}
