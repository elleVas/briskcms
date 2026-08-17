import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  loginUser,
  logoutUser,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from '@brisk/application';
import {
  InvalidCredentialsError,
  InvalidOrExpiredTokenError,
} from '@brisk/domain-core';
import type {
  AuthPort,
  EmailPort,
  UserRepositoryPort,
  VerificationTokenPort,
} from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  AUTH_PORT,
  DEFAULT_TENANT_ID,
  EDITOR_APP_URL,
  EMAIL_PORT,
  USER_REPOSITORY,
  VERIFICATION_TOKEN_PORT,
} from './auth.tokens.js';
import {
  loginBodySchema,
  type LoginBody,
  requestPasswordResetBodySchema,
  type RequestPasswordResetBody,
  resetPasswordBodySchema,
  type ResetPasswordBody,
  verifyEmailBodySchema,
  type VerifyEmailBody,
} from './auth.schemas.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import {
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from './session-cookie.constants.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(AUTH_PORT) private readonly authPort: AuthPort,
    @Inject(VERIFICATION_TOKEN_PORT)
    private readonly verificationTokenPort: VerificationTokenPort,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
    @Inject(DEFAULT_TENANT_ID) private readonly defaultTenantId: string,
    @Inject(EDITOR_APP_URL) private readonly editorAppUrl: string,
  ) {}

  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginBodySchema)) body: LoginBody,
    @Res({ passthrough: true }) response: Response,
  ) {
    let session;
    try {
      session = await loginUser(
        { userRepository: this.userRepository, authPort: this.authPort },
        {
          tenantId: this.defaultTenantId,
          email: body.email,
          password: body.password,
        },
      );
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }

    response.cookie(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });
    return { userId: session.userId };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token: unknown = request.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token === 'string') {
      await logoutUser({ authPort: this.authPort }, { token });
    }
    response.clearCookie(SESSION_COOKIE_NAME);
    return { success: true };
  }

  @UseGuards(SessionAuthGuard)
  @Post('verify-email/resend')
  @HttpCode(200)
  async resendVerificationEmail(@Req() request: AuthenticatedRequest) {
    await requestEmailVerification(
      {
        userRepository: this.userRepository,
        verificationTokenPort: this.verificationTokenPort,
        emailPort: this.emailPort,
      },
      {
        tenantId: request.tenantId,
        userId: request.userId,
        verifyUrlBase: this.editorAppUrl,
      },
    );
    return { success: true };
  }

  @Post('verify-email')
  @HttpCode(200)
  async confirmEmailVerification(
    @Body(new ZodValidationPipe(verifyEmailBodySchema)) body: VerifyEmailBody,
  ) {
    try {
      await verifyEmail(
        {
          userRepository: this.userRepository,
          verificationTokenPort: this.verificationTokenPort,
        },
        { token: body.token },
      );
    } catch (error) {
      if (error instanceof InvalidOrExpiredTokenError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    return { success: true };
  }

  @UseGuards(ThrottlerGuard)
  @Post('request-password-reset')
  @HttpCode(200)
  async requestPasswordReset(
    @Body(new ZodValidationPipe(requestPasswordResetBodySchema))
    body: RequestPasswordResetBody,
  ) {
    await requestPasswordReset(
      {
        userRepository: this.userRepository,
        verificationTokenPort: this.verificationTokenPort,
        emailPort: this.emailPort,
      },
      {
        tenantId: this.defaultTenantId,
        email: body.email,
        resetUrlBase: this.editorAppUrl,
      },
    );
    // Always the same response, whether or not the email matched a real
    // account — see requestPasswordReset's own anti-enumeration doc comment.
    return { success: true };
  }

  @Post('reset-password')
  @HttpCode(200)
  async confirmPasswordReset(
    @Body(new ZodValidationPipe(resetPasswordBodySchema))
    body: ResetPasswordBody,
  ) {
    try {
      await resetPassword(
        {
          userRepository: this.userRepository,
          verificationTokenPort: this.verificationTokenPort,
          authPort: this.authPort,
        },
        { token: body.token, newPassword: body.newPassword },
      );
    } catch (error) {
      if (error instanceof InvalidOrExpiredTokenError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    return { success: true };
  }
}
