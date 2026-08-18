import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/auth-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { VerifyEmailView } from './verify-email-view.js';

vi.mock('../lib/auth-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/auth-api-client.js')>();
  return { ...actual, verifyEmail: vi.fn() };
});

function renderView(token: string) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <VerifyEmailView token={token} />
    </QueryClientProvider>,
  );
}

describe('VerifyEmailView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a success message once the token is confirmed', async () => {
    vi.mocked(api.verifyEmail).mockResolvedValue({ success: true });

    renderView('a-token');

    expect(screen.getByText(/verifica in corso/i)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText(/verificata con successo/i)).toBeTruthy(),
    );
    expect(api.verifyEmail).toHaveBeenCalledWith('a-token');
  });

  it('shows an error message when the token is invalid or expired', async () => {
    vi.mocked(api.verifyEmail).mockRejectedValue(new Error('bad token'));

    renderView('bad-token');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('non è valido o è scaduto');
  });
});
