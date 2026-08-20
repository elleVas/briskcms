import type { ComponentConfig } from '@puckeditor/core';
import { countdownPropsSchema, type CountdownProps } from '@brisk/shared-types';

export { countdownPropsSchema, type CountdownProps };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const countdownConfig: ComponentConfig<CountdownProps> = {
  label: 'Countdown',
  fields: {
    // Not contentEditable: this needs to stay a strictly-formatted ISO
    // datetime string (Countdown.astro parses it directly), and free-typing
    // on the canvas has no format guardrail — kept as a sidebar field.
    targetDate: { type: 'text', placeholder: '2026-12-31T23:59' },
    label: { type: 'text', contentEditable: true, visible: false },
  },
  defaultProps: {
    targetDate: new Date(Date.now() + THIRTY_DAYS_MS)
      .toISOString()
      .slice(0, 16),
    label: 'Offerta valida fino a',
  },
  // Static preview only — the live setInterval countdown lives entirely in
  // apps/public-site/src/components/blocks/Countdown.astro, same split as
  // HamburgerMenu (hamburger-menu.block.tsx has no real open/close either,
  // only its Astro counterpart does).
  render: ({ targetDate, label }) => (
    <div>
      {label && <p>{label}</p>}
      <strong>{targetDate || 'Nessuna data impostata'}</strong>
    </div>
  ),
};
