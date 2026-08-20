import type { ComponentConfig, Fields } from '@puckeditor/core';
import { statPropsSchema, type StatProps } from '@brisk/shared-types';
import { createResolveFields } from '../fields/resolve-inline-text-fallback.js';

export { statPropsSchema, type StatProps };

const fields: Fields<StatProps> = {
  // Not contentEditable: `value` drives the public-site count-up animation
  // (StatsCounter.astro parses it directly) and needs to stay a plain
  // number, not a free-typed inline node — same reasoning as Countdown's
  // `targetDate`.
  value: { type: 'number' },
  prefix: { type: 'text' },
  suffix: { type: 'text' },
  label: { type: 'text', contentEditable: true, visible: false },
};

export const statConfig: ComponentConfig<StatProps> = {
  label: 'Statistica',
  fields,
  resolveFields: createResolveFields(fields),
  defaultProps: {
    value: 100,
    prefix: '',
    suffix: '',
    label: 'Etichetta',
  },
  // Static preview only — the count-up animation itself only exists on
  // apps/public-site (StatsCounter.astro), same split as Countdown.
  render: ({ value, prefix, suffix, label }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>
        {prefix}
        {value}
        {suffix}
      </div>
      <div style={{ fontSize: 13, color: '#71717a', marginTop: 4 }}>
        {label}
      </div>
    </div>
  ),
};
