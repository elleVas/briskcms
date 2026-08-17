import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form.js';

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: /accedi/i }));
}

describe('LoginForm', () => {
  it('calls onLogin with the entered credentials', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onLogin={onLogin} />);

    fillAndSubmit('lele@example.com', 'correct-horse-battery');

    await waitFor(() =>
      expect(onLogin).toHaveBeenCalledWith(
        'lele@example.com',
        'correct-horse-battery',
      ),
    );
  });

  it('shows an error message when onLogin rejects', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('Unauthorized'));
    render(<LoginForm onLogin={onLogin} />);

    fillAndSubmit('lele@example.com', 'wrong-password');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Email o password non corretti.');
  });

  it('does not call onLogin again until the previous attempt settles', async () => {
    let resolveLogin: () => void = () => undefined;
    const onLogin = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    render(<LoginForm onLogin={onLogin} />);

    fillAndSubmit('lele@example.com', 'correct-horse-battery');
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(
      true,
    );

    resolveLogin();
    await waitFor(() =>
      expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
  });
});
