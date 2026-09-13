import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateField, TimeField } from './date-time-fields';

describe('DateField', () => {
  it('shows a stored date and writes back the ISO day the browser gives', () => {
    const onChange = vi.fn();
    const { container } = render(
      <DateField value="2026-09-13" onChange={onChange} />,
    );
    const input = container.querySelector('input');
    if (!input) throw new Error('DateField rendered no input');

    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-09-13');

    fireEvent.change(input, { target: { value: '2026-10-01' } });
    expect(onChange).toHaveBeenCalledWith('2026-10-01');
  });

  it('treats anything that is not a string as no date, rather than crashing on it', () => {
    const { container } = render(<DateField value={null} onChange={vi.fn()} />);
    expect(container.querySelector('input')?.value).toBe('');
  });

  it('writes the empty string when cleared', () => {
    const onChange = vi.fn();
    const { container } = render(
      <DateField value="2026-09-13" onChange={onChange} />,
    );
    const input = container.querySelector('input');
    if (!input) throw new Error('DateField rendered no input');

    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('TimeField', () => {
  it('shows a stored time and writes back HH:MM', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimeField value="20:30" onChange={onChange} />,
    );
    const input = container.querySelector('input');
    if (!input) throw new Error('TimeField rendered no input');

    expect(input.type).toBe('time');
    expect(input.value).toBe('20:30');

    fireEvent.change(input, { target: { value: '21:00' } });
    expect(onChange).toHaveBeenCalledWith('21:00');
  });
});
