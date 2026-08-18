import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteError } from './route-error.js';

describe('RouteError', () => {
  it('shows the error and calls reset when retrying', () => {
    const reset = vi.fn();

    render(<RouteError error={new Error('network down')} reset={reset} />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/network down/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /riprova/i }));
    expect(reset).toHaveBeenCalled();
  });
});
