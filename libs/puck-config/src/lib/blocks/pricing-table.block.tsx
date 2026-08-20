import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import {
  pricingTablePropsSchema,
  type PricingTableProps,
} from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { pricingTablePropsSchema, type PricingTableProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `PricingTableProps` (the domain schema, empty) — same reasoning as
// column.block.tsx's own `ColumnPuckProps`.
export interface PricingTablePuckProps {
  children: Slot;
}

const PRICING_TABLE_COLOR = '#ca8a04';

const fields: Fields<PricingTablePuckProps> = {
  children: { type: 'slot', allow: ['PricingPlan'] },
};

export const pricingTableConfig: ComponentConfig<PricingTablePuckProps> = {
  label: 'Tabella prezzi',
  fields,
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <EditorChrome label="Tabella prezzi" color={PRICING_TABLE_COLOR}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <Children />
      </div>
    </EditorChrome>
  ),
};
