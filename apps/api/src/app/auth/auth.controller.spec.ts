import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { User } from '@brisk/domain-core';
import type { AuthPort, Session, UserRepositoryPort } from '@brisk/ports';
import { AuthController } from './auth.controller.js';
import { SESSION_COOKIE_NAME } from './session-cookie.constants.js';

const tenantId = 'tenant-1';

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

describe('AuthController', () => {
  let userRepository: jest.Mocked<UserRepositoryPort>;
  let authPort: jest.Mocked<AuthPort>;
  let controller: AuthController;

  beforeEach(() => {
    userRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
    };
    authPort = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
      createSession: jest.fn(),
      validateSession: jest.fn(),
      invalidateSession: jest.fn(),
    };
    controller = new AuthController(userRepository, authPort, tenantId);
  });

  describe('login', () => {
    it('sets a session cookie and returns the user id on success', async () => {
      const user = User.create({
        id: 'user-1',
        tenantId,
        email: 'lele@example.com',
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
        { email: 'lele@example.com', password: 'correct' },
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
          { email: 'nobody@example.com', password: 'irrelevant' },
          response,
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(response.cookie).not.toHaveBeenCalled();
    });

    it('lets unexpected errors propagate unchanged', async () => {
      userRepository.findByEmail.mockRejectedValue(new Error('db exploded'));
      const response = buildResponse();

      await expect(
        controller.login(
          { email: 'lele@example.com', password: 'irrelevant' },
          response,
        ),
      ).rejects.toThrow('db exploded');
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
});
