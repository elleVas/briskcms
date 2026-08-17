import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../lib/pages-api-client.js';
import { ResetPasswordForm } from './reset-password-form.js';

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return { ...actual, resetPassword: vi.fn() };
});

function fillAndSubmit(password: string) {
  fireEvent.change(screen.getByLabelText('Nuova password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: /reimposta password/i }));
}

describe('ResetPasswordForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('submits the token and new password, then shows a confirmation', async () => {
    vi.mocked(api.resetPassword).mockResolvedValue({ success: true });
    render(<ResetPasswordForm token="a-token" />);

    fillAndSubmit('new-password-123');

    await waitFor(() =>
      expect(screen.getByText(/password aggiornata/i)).toBeTruthy(),
    );
    expect(api.resetPassword).toHaveBeenCalledWith(
      'a-token',
      'new-password-123',
    );
  });

  it('shows an error message when the token is invalid or expired', async () => {
    vi.mocked(api.resetPassword).mockRejectedValue(new Error('bad token'));
    render(<ResetPasswordForm token="bad-token" />);

    fillAndSubmit('new-password-123');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('non è valido o è scaduto');
  });
});
