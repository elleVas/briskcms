import type { CountdownProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const countdownBlock: BlockDescriptor<CountdownProps> = {
  type: 'Countdown',
  label: 'Countdown',
  category: 'conversion',
  defaultProps: {
    targetDate: new Date(Date.now() + THIRTY_DAYS_MS)
      .toISOString()
      .slice(0, 16),
    label: 'Offerta valida fino a',
  },
  fields: [
    // Non inlineEditable: deve restare una data ISO in formato stretto
    // (Countdown.astro la fa il parse diretto) — il digitare libero
    // sul canvas non ha alcun controllo di formato.
    {
      kind: 'text',
      key: 'targetDate',
      label: 'Data/ora obiettivo',
      placeholder: '2026-12-31T23:59',
    },
    { kind: 'text', key: 'label', label: 'Etichetta', inlineEditable: true },
  ],
};
