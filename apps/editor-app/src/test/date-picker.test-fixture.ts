import { fireEvent, screen } from '@testing-library/react';

/**
 * Opens a DatePicker and waits for its month grid, which is loaded the
 * first time a calendar opens (components/ui/calendar.tsx). The first load
 * in a test file takes over a second under jsdom — date-fns' locales are
 * many small modules — hence more than findBy's default second.
 */
export async function openCalendar(trigger: HTMLElement): Promise<void> {
  fireEvent.click(trigger);
  await screen.findByRole('grid', undefined, { timeout: 5000 });
}

/** A day of the open calendar's month, by its number — the grid's own button, not a navigation one. */
export function dayButton(day: string): HTMLElement {
  const button = screen
    .getAllByRole('button')
    .find(
      (candidate) =>
        candidate.textContent === day &&
        candidate.closest('[role="gridcell"]') !== null,
    );
  if (!button) throw new Error(`No day ${day} in the open calendar`);
  return button;
}
