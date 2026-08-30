import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OpeningHoursDay } from '@brisk/shared-types';
import { TooltipProvider } from '../components/ui/tooltip';
import { OpeningHoursEditor } from './opening-hours-editor';

const emptyWeek: OpeningHoursDay[] = [
  { dayOfWeek: 'monday', ranges: [] },
  { dayOfWeek: 'tuesday', ranges: [] },
  { dayOfWeek: 'wednesday', ranges: [] },
  { dayOfWeek: 'thursday', ranges: [] },
  { dayOfWeek: 'friday', ranges: [] },
  { dayOfWeek: 'saturday', ranges: [] },
  { dayOfWeek: 'sunday', ranges: [] },
];

function renderEditor(
  value: OpeningHoursDay[] = emptyWeek,
  onChange: (value: OpeningHoursDay[]) => void = vi.fn(),
) {
  return render(
    <TooltipProvider>
      <OpeningHoursEditor value={value} onChange={onChange} />
    </TooltipProvider>,
  );
}

describe('OpeningHoursEditor', () => {
  it('shows all 7 days, closed by default', () => {
    renderEditor();

    expect(screen.getByText('Lunedì')).toBeTruthy();
    expect(screen.getByText('Domenica')).toBeTruthy();
    expect(screen.getAllByText('Chiuso')).toHaveLength(7);
  });

  it('adds a default range to a day', () => {
    const onChange = vi.fn();
    renderEditor(emptyWeek, onChange);

    const [firstAddButton] = screen.getAllByText('Aggiungi fascia');
    fireEvent.click(firstAddButton);

    expect(onChange).toHaveBeenCalledWith([
      { dayOfWeek: 'monday', ranges: [{ opens: '09:00', closes: '18:00' }] },
      ...emptyWeek.slice(1),
    ]);
  });

  it('supports a second range on the same day, e.g. a lunch closure', () => {
    const onChange = vi.fn();
    const withOneRange = [
      {
        dayOfWeek: 'monday' as const,
        ranges: [{ opens: '09:00', closes: '13:00' }],
      },
      ...emptyWeek.slice(1),
    ];
    renderEditor(withOneRange, onChange);

    const [firstAddButton] = screen.getAllByText('Aggiungi fascia');
    fireEvent.click(firstAddButton);

    expect(onChange).toHaveBeenCalledWith([
      {
        dayOfWeek: 'monday',
        ranges: [
          { opens: '09:00', closes: '13:00' },
          { opens: '09:00', closes: '18:00' },
        ],
      },
      ...emptyWeek.slice(1),
    ]);
  });

  it('changes the opens/closes time of a range', () => {
    const onChange = vi.fn();
    const withOneRange = [
      {
        dayOfWeek: 'monday' as const,
        ranges: [{ opens: '09:00', closes: '18:00' }],
      },
      ...emptyWeek.slice(1),
    ];
    renderEditor(withOneRange, onChange);

    const timeInputs = screen.getAllByDisplayValue('09:00');
    fireEvent.change(timeInputs[0], { target: { value: '10:00' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        dayOfWeek: 'monday',
        ranges: [{ opens: '10:00', closes: '18:00' }],
      },
      ...emptyWeek.slice(1),
    ]);
  });

  it('removes a range', () => {
    const onChange = vi.fn();
    const withOneRange = [
      {
        dayOfWeek: 'monday' as const,
        ranges: [{ opens: '09:00', closes: '18:00' }],
      },
      ...emptyWeek.slice(1),
    ];
    renderEditor(withOneRange, onChange);

    fireEvent.click(screen.getByRole('button', { name: /rimuovi fascia/i }));

    expect(onChange).toHaveBeenCalledWith(emptyWeek);
  });
});
