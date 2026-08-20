import type { ComponentConfig, Slot } from '@puckeditor/core';
import { columnPropsSchema, type ColumnProps } from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { columnPropsSchema, type ColumnProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `ColumnProps` (the domain schema) — at the domain level nested content
// lives in `Block.children`, not in `props`, same reasoning as
// nav.block.tsx's own `NavPuckProps`.
export interface ColumnPuckProps {
  children: Slot;
}

const COLUMN_COLOR = '#0d9488';

export const columnConfig: ComponentConfig<ColumnPuckProps> = {
  label: 'Colonna',
  // No `allow` list (was previously restricted to Hero/Text/Image/
  // Gallery/Form only) — a Column is meant to hold whatever the page needs
  // side by side with its siblings, same reasoning as Container's own
  // unrestricted slot.
  fields: {
    children: { type: 'slot' },
  },
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <EditorChrome label="Colonna" color={COLUMN_COLOR}>
      <Children />
    </EditorChrome>
  ),
};
