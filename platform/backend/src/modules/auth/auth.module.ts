import { Global, Module } from '@nestjs/common';
import { AccountSecurityController } from './account-security.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleIdTokenVerifier } from './google.verifier';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';
import { TokenService } from './token.service';

@Global()
@Module({
  controllers: [AuthController, AccountSecurityController],
  providers: [AuthService, OtpService, PasswordService, SessionsService, TokenService, GoogleIdTokenVerifier],
  exports: [AuthService, SessionsService, TokenService, PasswordService, OtpService],
})
export class AuthModule {}
