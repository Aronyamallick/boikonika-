import { Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  forgotPasswordSchema,
  googleLoginSchema,
  loginSchema,
  otpLoginSchema,
  otpRequestSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  twoFactorLoginSchema,
  usernameSchema,
  type AuthResult,
  type TwoFactorChallenge,
} from '@boikonika/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { requestContext } from '../../common/context/request-context';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { AuthThrottle } from '../../common/decorators/throttle.decorators';
import { AppException } from '../../common/errors/app-exception';
import { CookieCsrfGuard } from '../../common/guards/csrf.guard';
import { withMessage } from '../../common/http/response';
import type { RequestWithContext } from '../../common/http/request-id.middleware';
import { ZodBody, ZodQuery } from '../../common/validation/zod';
import { t } from '../../common/i18n';
import { AuthService, type SignInOutcome } from './auth.service';
import { REFRESH_COOKIE, SessionsService } from './sessions.service';

type RegisterBody = z.output<typeof registerSchema>;
type LoginBody = z.output<typeof loginSchema>;
type OtpLoginBody = z.output<typeof otpLoginSchema>;
type DeviceBody = Pick<LoginBody, 'deviceName' | 'deviceId' | 'client' | 'rememberDevice'>;

const device = (body: DeviceBody) => ({ deviceName: body.deviceName, deviceId: body.deviceId, client: body.client, rememberDevice: body.rememberDevice });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Public()
  @AuthThrottle()
  @Post('otp/request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a 6-digit code (register, login, reset_password; verify_email/verify_phone need a session)' })
  async requestOtp(@ZodBody(otpRequestSchema) body: z.output<typeof otpRequestSchema>, @CurrentUser() user?: AuthenticatedUser) {
    const result = await this.auth.requestOtp(body.target, body.purpose, body.locale ?? requestContext.locale(), user?.id);
    return withMessage(result, t('api.auth.otpSent', { target: result.sentTo }));
  }

  @Public()
  @AuthThrottle()
  @Get('username-available')
  @ApiOperation({ summary: 'Check whether a username is free (registration form)' })
  async usernameAvailable(@ZodQuery(z.object({ username: usernameSchema })) query: { username: string }) {
    return { username: query.username.toLowerCase(), available: await this.auth.usernameAvailable(query.username) };
  }

  @Public()
  @AuthThrottle()
  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an account with the code sent to the email or phone, and sign in' })
  async register(@ZodBody(registerSchema) body: RegisterBody, @Res({ passthrough: true }) res: Response): Promise<AuthResult> {
    const outcome = await this.auth.register({ name: body.name, target: body.target, code: body.code, password: body.password, username: body.username, isStudent: body.isStudent, locale: body.locale, device: device(body) });
    return this.finish(outcome, body.client, res);
  }

  @Public()
  @AuthThrottle()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with email, BD mobile number or username and a password' })
  async login(@ZodBody(loginSchema) body: LoginBody, @Res({ passthrough: true }) res: Response): Promise<AuthResult | TwoFactorChallenge> {
    const outcome = await this.auth.login(body.identifier, body.password, device(body));
    return 'twoFactorRequired' in outcome ? outcome : this.finish(outcome, body.client, res);
  }

  @Public()
  @AuthThrottle()
  @Post('login/otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Passwordless sign-in with a code from POST /auth/otp/request (purpose "login")' })
  async loginWithOtp(@ZodBody(otpLoginSchema) body: OtpLoginBody, @Res({ passthrough: true }) res: Response): Promise<AuthResult | TwoFactorChallenge> {
    const outcome = await this.auth.loginWithOtp(body.target, body.code, device(body));
    return 'twoFactorRequired' in outcome ? outcome : this.finish(outcome, body.client, res);
  }

  @Public()
  @AuthThrottle()
  @Post('login/2fa')
  @HttpCode(200)
  @ApiOperation({ summary: 'Finish a sign-in that requires two-step verification (authenticator code or recovery code)' })
  async loginWithTwoFactor(@ZodBody(twoFactorLoginSchema) body: z.output<typeof twoFactorLoginSchema>, @Res({ passthrough: true }) res: Response): Promise<AuthResult> {
    const outcome = await this.auth.loginWithTwoFactor(body.challengeToken, body.code, body.recoveryCode);
    return this.finish(outcome, outcome.session.platform as LoginBody['client'], res);
  }

  @Public()
  @AuthThrottle()
  @Post('google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in or sign up with a Google ID token (web, Android, iOS)' })
  async google(@ZodBody(googleLoginSchema) body: z.output<typeof googleLoginSchema>, @Res({ passthrough: true }) res: Response): Promise<AuthResult | TwoFactorChallenge> {
    const outcome = await this.auth.loginWithGoogle(body.idToken, device(body), requestContext.locale());
    return 'twoFactorRequired' in outcome ? outcome : this.finish(outcome, body.client, res);
  }

  @Public()
  @UseGuards(CookieCsrfGuard)
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token (HTTP-only cookie on web, body on mobile) and get a new access token' })
  async refresh(@ZodBody(refreshSchema) body: z.output<typeof refreshSchema>, @Req() req: RequestWithContext, @Res({ passthrough: true }) res: Response): Promise<AuthResult> {
    const fromBody = body.refreshToken;
    const token = fromBody ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!token) throw new AppException('UNAUTHORIZED', 'api.auth.sessionExpired');
    try {
      const outcome = await this.auth.refresh(token);
      return this.finish(outcome, fromBody ? 'android' : 'web', res);
    } catch (error) {
      if (!fromBody && error instanceof AppException && error.code === 'UNAUTHORIZED') this.sessions.clearRefreshCookie(res);
      throw error;
    }
  }

  @Public()
  @UseGuards(CookieCsrfGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Sign out of this device' })
  async logout(@ZodBody(refreshSchema) body: z.output<typeof refreshSchema>, @Req() req: RequestWithContext, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.user?.sessionId ?? null, body.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? null);
    this.sessions.clearRefreshCookie(res);
    return withMessage(null, t('api.auth.loggedOut'));
  }

  @Public()
  @AuthThrottle()
  @Post('password/forgot')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a password reset code (same response whether or not the account exists)' })
  async forgot(@ZodBody(forgotPasswordSchema) body: z.output<typeof forgotPasswordSchema>) {
    const result = await this.auth.forgotPassword(body.target, body.locale ?? requestContext.locale());
    return withMessage(result, t('api.auth.resetCodeSent', { target: result.sentTo }));
  }

  @Public()
  @AuthThrottle()
  @Post('password/reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Set a new password with the reset code; signs out every device' })
  async reset(@ZodBody(resetPasswordSchema) body: z.output<typeof resetPasswordSchema>) {
    await this.auth.resetPassword(body.target, body.code, body.password);
    return withMessage(null, t('api.auth.passwordReset'));
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'The signed-in user with roles and effective permissions' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  /** Web: refresh token in an HTTP-only cookie. Mobile: in the body for SecureStore. */
  private finish(outcome: SignInOutcome, client: LoginBody['client'], res: Response): AuthResult {
    if (client === 'web') {
      this.sessions.setRefreshCookie(res, outcome.refreshToken, outcome.session);
      return outcome.result;
    }
    return { ...outcome.result, tokens: { ...outcome.result.tokens, refreshToken: outcome.refreshToken } };
  }
}
