import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import {
  columnsGridTemplate,
  columnsPropsSchema,
  type ColumnsProps,
} from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { columnsPropsSchema, type ColumnsProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `ColumnsProps` (the domain schema) — see column.block.tsx's own comment.
export interface ColumnsPuckProps extends ColumnsProps {
  children: Slot;
}

const COLUMNS_COLOR = '#2563eb';

const fields: Fields<ColumnsPuckProps> = {
  layout: {
    type: 'radio',
    options: [
      { label: '2 uguali', value: 'two-equal' },
      { label: '2 (30/70)', value: 'two-asymmetric' },
      { label: '3 uguali', value: 'three-equal' },
    ],
  },
  children: { type: 'slot', allow: ['Column'] },
};

export const columnsConfig: ComponentConfig<ColumnsPuckProps> = {
  label: 'Colonne',
  fields,
  defaultProps: { layout: 'two-equal', children: [] },
  render: ({ layout, children: Children }) => (
    <EditorChrome label="Colonne" color={COLUMNS_COLOR}>
      <Children
        style={{
          display: 'grid',
          gridTemplateColumns: columnsGridTemplate(layout),
          gap: 16,
        }}
      />
    </EditorChrome>
  ),
};
