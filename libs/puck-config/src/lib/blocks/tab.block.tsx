import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import { tabPropsSchema, type TabProps } from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { tabPropsSchema, type TabProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `TabProps` (the domain schema) — same reasoning as column.block.tsx's
// own `ColumnPuckProps`. Unlike AccordionItem (plain text question/answer),
// a tab panel can hold arbitrary content, so it gets its own nested slot,
// same allow-list as Column's.
export interface TabPuckProps {
  label: string;
  children: Slot;
}

const TAB_COLOR = '#2563eb';

const fields: Fields<TabPuckProps> = {
  label: { type: 'text' },
  children: {
    type: 'slot',
    allow: ['Hero', 'Text', 'Image', 'Gallery', 'Form'],
  },
};

export const tabConfig: ComponentConfig<TabPuckProps> = {
  label: 'Tab',
  fields,
  defaultProps: { label: 'Tab', children: [] },
  render: ({ label, children: Children }) => (
    <EditorChrome label={`Tab: ${label}`} color={TAB_COLOR}>
      <Children />
    </EditorChrome>
  ),
};
