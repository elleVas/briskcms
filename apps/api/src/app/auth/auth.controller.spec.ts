import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { User } from '@brisk/domain-core';
import type {
  AuthPort,
  CaptchaPort,
  EmailPort,
  Session,
  UserRepositoryPort,
  VerificationToken,
  VerificationTokenPort,
} from '@brisk/ports';
import { AuthController } from './auth.controller.js';
import { SESSION_COOKIE_NAME } from './session-cookie.constants.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';

const tenantId = 'tenant-1';
const editorAppUrl = 'https://editor.example.com';

function buildResponse() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
}

// Express's Request has 100+ members — only `cookies` is read here, so a
// minimal double stands in via `unknown` rather than implementing the whole
// interface.
function fakeRequest(cookies: Record<string, string | undefined>): Request {
  return { cookies } as unknown as Request;
}

function fakeAuthenticatedRequest(): AuthenticatedRequest {
  return {
    tenantId,
    userId: 'user-1',
  } as unknown as AuthenticatedRequest;
}

describe('AuthController', () => {
  let userRepository: jest.Mocked<UserRepositoryPort>;
  let authPort: jest.Mocked<AuthPort>;
  let verificationTokenPort: jest.Mocked<VerificationTokenPort>;
  let emailPort: jest.Mocked<EmailPort>;
  let captchaPort: jest.Mocked<CaptchaPort>;
  let controller: AuthController;

  beforeEach(() => {
    userRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      list: jest.fn(),
    };
    authPort = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
      createSession: jest.fn(),
      validateSession: jest.fn(),
      invalidateSession: jest.fn(),
      invalidateAllSessionsForUser: jest.fn(),
    };
    verificationTokenPort = {
      createToken: jest.fn(),
      consumeToken: jest.fn(),
    };
    emailPort = {
      sendEmail: jest.fn(),
    };
    // Passes by default — the captcha-specific tests below override it.
    captchaPort = { verify: jest.fn().mockResolvedValue(true) };
    controller = new AuthController(
      userRepository,
      authPort,
      verificationTokenPort,
      emailPort,
      captchaPort,
      tenantId,
      editorAppUrl,
    );
  });

  describe('login', () => {
    it('sets a session cookie and returns the user id on success', async () => {
      const user = User.create({
        id: 'user-1',
        tenantId,
        email: 'lele@example.com',
        displayName: 'Lele',
        passwordHash: 'hashed',
        role: 'admin',
      });
      userRepository.findByEmail.mockResolvedValue(user);
      authPort.verifyPassword.mockResolvedValue(true);
      const session: Session = {
        token: 'a-token',
        userId: 'user-1',
        tenantId,
        expiresAt: new Date(),
      };
      authPort.createSession.mockResolvedValue(session);
      const response = buildResponse();

      const result = await controller.login(
        {
          email: 'lele@example.com',
          password: 'correct',
          captchaToken: 'valid-token',
        },
        response,
      );

      expect(result).toEqual({ userId: 'user-1' });
      expect(response.cookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        'a-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
    });

    it('maps InvalidCredentialsError to a 401', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      const response = buildResponse();

      await expect(
        controller.login(
          {
            email: 'nobody@example.com',
            password: 'irrelevant',
            captchaToken: 'valid-token',
          },
          response,
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(response.cookie).not.toHaveBeenCalled();
    });

    it('maps a deactivated account to the same generic 401 as bad credentials (no enumeration)', async () => {
      const user = User.create({
        id: 'user-1',
        tenantId,
        email: 'lele@example.com',
        displayName: 'Lele',
        passwordHash: 'hashed',
        role: 'admin',
        isActive: false,
      });
      userRepository.findByEmail.mockResolvedValue(user);
      authPort.verifyPassword.mockResolvedValue(true);
      const response = buildResponse();

      let caught: unknown;
      try {
        await controller.login(
          {
            email: 'lele@example.com',
            password: 'correct',
            captchaToken: 'valid-token',
          },
          response,
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(UnauthorizedException);
      expect((caught as UnauthorizedException).message).toBe(
        'Invalid email or password',
      );
      expect(authPort.createSession).not.toHaveBeenCalled();
      expect(response.cookie).not.toHaveBeenCalled();
    });

    it('lets unexpected errors propagate unchanged', async () => {
      userRepository.findByEmail.mockRejectedValue(new Error('db exploded'));
      const response = buildResponse();

      await expect(
        controller.login(
          {
            email: 'lele@example.com',
            password: 'irrelevant',
            captchaToken: 'valid-token',
          },
          response,
        ),
      ).rejects.toThrow('db exploded');
    });

    it('maps InvalidCaptchaError to a 400, before even looking up the account', async () => {
      captchaPort.verify.mockResolvedValue(false);
      const response = buildResponse();

      await expect(
        controller.login(
          {
            email: 'lele@example.com',
            password: 'correct',
            captchaToken: 'bad-token',
          },
          response,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(response.cookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('invalidates the session and clears the cookie when a session cookie is present', async () => {
      const request = fakeRequest({ [SESSION_COOKIE_NAME]: 'a-token' });
      const response = buildResponse();

      const result = await controller.logout(request, response);

      expect(authPort.invalidateSession).toHaveBeenCalledWith('a-token');
      expect(response.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
      expect(result).toEqual({ success: true });
    });

    it('clears the cookie even when there is no session cookie to invalidate', async () => {
      const request = fakeRequest({});
      const response = buildResponse();

      await controller.logout(request, response);

      expect(authPort.invalidateSession).not.toHaveBeenCalled();
      expect(response.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
    });

    it('clears the cookie even when cookie-parser never ran (cookies is undefined)', async () => {
      const request = { cookies: undefined } as unknown as Request;
      const response = buildResponse();

      await controller.logout(request, response);

      expect(authPort.invalidateSession).not.toHaveBeenCalled();
      expect(response.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
    });
  });

  describe('resendVerificationEmail', () => {
    it('sends a verification email for the authenticated user', async () => {
      const user = User.create({
        id: 'user-1',
        tenantId,
        email: 'lele@example.com',
        displayName: 'Lele',
        passwordHash: 'hashed',
        role: 'admin',
      });
      userRepository.findById.mockResolvedValue(user);
      const token: VerificationToken = {
        token: 'a-token',
        userId: 'user-1',
        tenantId,
        purpose: 'email-verification',
        expiresAt: new Date(),
      };
      verificationTokenPort.createToken.mockResolvedValue(token);

      const result = await controller.resendVerificationEmail(
        fakeAuthenticatedRequest(),
      );

      expect(emailPort.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'lele@example.com' }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('confirmEmailVerification', () => {
    it('returns success when the token is valid', async () => {
      const user = User.create({
        id: 'user-1',
        tenantId,
        email: 'lele@example.com',
        displayName: 'Lele',
        passwordHash: 'hashed',
        role: 'admin',
      });
      verificationTokenPort.consumeToken.mockResolvedValue({
        token: 'a-token',
        userId: 'user-1',
        tenantId,
        purpose: 'email-verification',
        expiresAt: new Date(),
      });
      userRepository.findById.mockResolvedValue(user);

      const result = await controller.confirmEmailVerification({
        token: 'a-token',
      });

      expect(result).toEqual({ success: true });
    });

    it('maps InvalidOrExpiredTokenError to a 400', async () => {
      verificationTokenPort.consumeToken.mockResolvedValue(null);

      await expect(
        controller.confirmEmailVerification({ token: 'bad-token' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lets unexpected errors propagate unchanged', async () => {
      verificationTokenPort.consumeToken.mockRejectedValue(
        new Error('db exploded'),
      );

      await expect(
        controller.confirmEmailVerification({ token: 'a-token' }),
      ).rejects.toThrow('db exploded');
    });
  });

  describe('requestPasswordReset', () => {
    it('always returns success, whether or not the email matches a user', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const result = await controller.requestPasswordReset({
        email: 'nobody@example.com',
        captchaToken: 'valid-token',
      });

      expect(result).toEqual({ success: true });
      expect(emailPort.sendEmail).not.toHaveBeenCalled();
    });

    it('maps InvalidCaptchaError to a 400, before even looking up the account', async () => {
      captchaPort.verify.mockResolvedValue(false);

      await expect(
        controller.requestPasswordReset({
          email: 'lele@example.com',
          captchaToken: 'bad-token',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('confirmPasswordReset', () => {
    it('returns success when the token is valid', async () => {
      const user = User.create({
        id: 'user-1',
        tenantId,
        email: 'lele@example.com',
        displayName: 'Lele',
        passwordHash: 'old-hash',
        role: 'admin',
      });
      verificationTokenPort.consumeToken.mockResolvedValue({
        token: 'a-token',
        userId: 'user-1',
        tenantId,
        purpose: 'password-reset',
        expiresAt: new Date(),
      });
      userRepository.findById.mockResolvedValue(user);
      authPort.hashPassword.mockResolvedValue('new-hash');

      const result = await controller.confirmPasswordReset({
        token: 'a-token',
        newPassword: 'new-password',
      });

      expect(authPort.invalidateAllSessionsForUser).toHaveBeenCalledWith(
        'user-1',
        tenantId,
      );
      expect(result).toEqual({ success: true });
    });

    it('maps InvalidOrExpiredTokenError to a 400', async () => {
      verificationTokenPort.consumeToken.mockResolvedValue(null);

      await expect(
        controller.confirmPasswordReset({
          token: 'bad-token',
          newPassword: 'new-password',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lets unexpected errors propagate unchanged', async () => {
      verificationTokenPort.consumeToken.mockRejectedValue(
        new Error('db exploded'),
      );

      await expect(
        controller.confirmPasswordReset({
          token: 'a-token',
          newPassword: 'new-password',
        }),
      ).rejects.toThrow('db exploded');
    });
  });
});
