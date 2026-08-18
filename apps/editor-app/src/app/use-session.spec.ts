import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../lib/auth-api-client.js';
import { useSession } from './use-session.js';

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
    vi.mocked(authApi.login).mockResolvedValue({ userId: 'user-1' });
    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.handleLogin('lele@example.com', 'correct');
    });

    expect(authApi.login).toHaveBeenCalledWith('lele@example.com', 'correct');
  });

  it('handleLogin propagates the error when login fails', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new Error('Invalid credentials'),
    );
    const { result } = renderHook(() => useSession());

    await expect(
      result.current.handleLogin('lele@example.com', 'wrong'),
    ).rejects.toThrow('Invalid credentials');
  });

  it('handleLogout calls the logout API', async () => {
    vi.mocked(authApi.logout).mockResolvedValue({ success: true });
    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(authApi.logout).toHaveBeenCalled();
  });

  it('handleLogout does not throw even if the server call fails', async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useSession());

    await expect(result.current.handleLogout()).resolves.toBeUndefined();
  });
});
