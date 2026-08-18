import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import * as authApi from '../lib/auth-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { LogoutButton } from './logout-button.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/auth-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/auth-api-client.js')>();
  return { ...actual, logout: vi.fn() };
});

function renderButton() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <LogoutButton />
    </QueryClientProvider>,
  );
}

describe('LogoutButton', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('logs out and navigates to /login when clicked', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(authApi.logout).mockResolvedValue({ success: true });

    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /^esci$/i }));

    await waitFor(() => expect(authApi.logout).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith({ to: '/login' });
  });
});
