import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../../components/ui/tooltip';
import { BreakpointSelector } from './breakpoint-selector';

describe('BreakpointSelector', () => {
  it('renders one button per breakpoint, marking the current one pressed', () => {
    render(
      <TooltipProvider>
        <BreakpointSelector value="tablet" onChange={vi.fn()} />
      </TooltipProvider>,
    );

    expect(
      screen
        .getByRole('button', { name: 'Desktop' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      screen
        .getByRole('button', { name: 'Tablet' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: 'Mobile' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('calls onChange with the clicked breakpoint', () => {
    const onChange = vi.fn();
    render(
      <TooltipProvider>
        <BreakpointSelector value="desktop" onChange={onChange} />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));

    expect(onChange).toHaveBeenCalledWith('mobile');
  });
});
