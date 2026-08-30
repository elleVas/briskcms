import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteError } from './route-error';

describe('RouteError', () => {
  it('shows the error and calls reset when retrying', () => {
    const reset = vi.fn();

    render(<RouteError error={new Error('network down')} reset={reset} />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/network down/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /riprova/i }));
    expect(reset).toHaveBeenCalled();
  });

  it('logs the error, so it does not disappear without a trace', () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('network down');

    render(<RouteError error={error} reset={vi.fn()} />);

    expect(errorSpy).toHaveBeenCalledWith('[route error]', error);
    errorSpy.mockRestore();
  });
});
