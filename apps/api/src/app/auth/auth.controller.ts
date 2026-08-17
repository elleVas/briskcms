import {
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
import { loginUser, logoutUser } from '@brisk/application';
import { InvalidCredentialsError } from '@brisk/domain-core';
import type { AuthPort, UserRepositoryPort } from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  AUTH_PORT,
  DEFAULT_TENANT_ID,
  USER_REPOSITORY,
} from './auth.tokens.js';
import { loginBodySchema, type LoginBody } from './auth.schemas.js';
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
    @Inject(DEFAULT_TENANT_ID) private readonly defaultTenantId: string,
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
}
