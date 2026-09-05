import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/http-client';
import { SetupWizardForm } from './setup-wizard-form';

// The suite runs pinned to Italian (test-setup.ts), so the queries below
// match the Italian copy — same convention as every other dialog spec here.
function fillAndSubmit(onSubmit: (input: never) => Promise<void>) {
  render(<SetupWizardForm onSubmit={onSubmit as never} />);

  fireEvent.change(screen.getByLabelText(/token di installazione/i), {
    target: { value: 'the-real-token' },
  });
  fireEvent.change(screen.getByLabelText(/nome del sito/i), {
    target: { value: 'Pasticceria Rossi' },
  });
  fireEvent.change(screen.getByLabelText(/la tua email/i), {
    target: { value: 'anna@example.test' },
  });
  fireEvent.change(screen.getByLabelText(/^password/i), {
    target: { value: 'a-long-enough-pass' },
  });
  fireEvent.click(screen.getByRole('button', { name: /crea il mio account/i }));
}

describe('SetupWizardForm', () => {
  it('sends the setup token along with the account details', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    fillAndSubmit(onSubmit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        setupToken: 'the-real-token',
        siteName: 'Pasticceria Rossi',
        adminEmail: 'anna@example.test',
      }),
    );
  });

  // The token is the one field whose rejection a person can act on, and
  // the action — re-read the API's log — is not guessable from a generic
  // "something went wrong".
  it('tells the user where to find a valid token when the server rejects it', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiError(401, 'Invalid setup token'));

    fillAndSubmit(onSubmit);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/log/i);
    expect(alert.textContent).toMatch(/riavvio/i);
  });

  it('falls back to the generic message for anything that is not a rejected token', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(500, 'boom'));

    fillAndSubmit(onSubmit);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/ricarica la pagina/i);
  });

  it('marks the token field required, so the browser blocks an empty submit', () => {
    render(<SetupWizardForm onSubmit={vi.fn()} />);

    // Plain DOM, not jest-dom: this suite has no jest-dom matchers set up.
    expect(screen.getByLabelText(/token di installazione/i)).toHaveProperty(
      'required',
      true,
    );
  });
});
