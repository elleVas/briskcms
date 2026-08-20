import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import {
  statsCounterPropsSchema,
  type StatsCounterProps,
} from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { statsCounterPropsSchema, type StatsCounterProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `StatsCounterProps` (the domain schema, empty) — same reasoning as
// column.block.tsx's own `ColumnPuckProps`.
export interface StatsCounterPuckProps {
  children: Slot;
}

const STATS_COUNTER_COLOR = '#dc2626';

const fields: Fields<StatsCounterPuckProps> = {
  children: { type: 'slot', allow: ['Stat'] },
};

export const statsCounterConfig: ComponentConfig<StatsCounterPuckProps> = {
  label: 'Contatori/statistiche',
  fields,
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <EditorChrome label="Contatori/statistiche" color={STATS_COUNTER_COLOR}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 16,
        }}
      >
        <Children />
      </div>
    </EditorChrome>
  ),
};
