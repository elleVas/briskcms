import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as router from '@tanstack/react-router';
import * as authApi from '../lib/auth-api-client.js';
import { useSession } from './use-session.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/auth-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/auth-api-client.js')>();
  return {
    ...actual,
    login: vi.fn(),
    logout: vi.fn(),
  };
});

describe('useSession', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handleLogin calls the login API with the given credentials', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(authApi.login).mockResolvedValue({ userId: 'user-1' });
    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.handleLogin('lele@example.com', 'correct');
    });

    expect(authApi.login).toHaveBeenCalledWith('lele@example.com', 'correct');
  });

  it('handleLogin propagates the error when login fails', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(authApi.login).mockRejectedValue(
      new Error('Invalid credentials'),
    );
    const { result } = renderHook(() => useSession());

    await expect(
      result.current.handleLogin('lele@example.com', 'wrong'),
    ).rejects.toThrow('Invalid credentials');
  });

  it('handleLogout calls the logout API and navigates to /login', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(authApi.logout).mockResolvedValue({ success: true });
    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(authApi.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({ to: '/login' });
  });

  it('handleLogout still navigates to /login even if the server call fails', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(navigate).toHaveBeenCalledWith({ to: '/login' });
  });
});
