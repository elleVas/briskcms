import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast, ToastProvider } from './toast-provider.js';

function TriggerButton({
  message,
  variant,
}: {
  message: string;
  variant?: 'default' | 'destructive' | 'success';
}) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast(message, variant)}>
      Trigger
    </button>
  );
}

function renderWithProvider(
  message: string,
  variant?: 'default' | 'destructive' | 'success',
) {
  return render(
    <ToastProvider>
      <TriggerButton message={message} variant={variant} />
    </ToastProvider>,
  );
}

describe('ToastProvider / useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast with the given message when triggered', () => {
    renderWithProvider('Salvataggio non riuscito');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
    });

    expect(screen.getByText('Salvataggio non riuscito')).not.toBeNull();
  });

  it('announces the toast via a live region, for screen readers', () => {
    renderWithProvider('Errore');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
    });

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Errore');
  });

  it('dismisses the toast when its close button is clicked', () => {
    renderWithProvider('Errore');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
    });
    expect(screen.getByText('Errore')).not.toBeNull();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Chiudi notifica' }));
    });

    expect(screen.queryByText('Errore')).toBeNull();
  });

  it('auto-dismisses the toast after its duration elapses', () => {
    renderWithProvider('Errore');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
    });
    expect(screen.getByText('Errore')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByText('Errore')).toBeNull();
  });

  it('throws when useToast is called outside a ToastProvider', () => {
    // React logs its own error boundary noise for a thrown render — silenced
    // here, it's expected and asserted on below via the thrown error itself.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => render(<TriggerButton message="x" />)).toThrow(
      'useToast must be used within a ToastProvider',
    );

    consoleError.mockRestore();
  });
});
