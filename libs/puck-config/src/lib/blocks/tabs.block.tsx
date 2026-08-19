import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import { tabsPropsSchema, type TabsProps } from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { tabsPropsSchema, type TabsProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `TabsProps` (the domain schema, empty) — same reasoning as
// column.block.tsx's own `ColumnPuckProps`.
export interface TabsPuckProps {
  children: Slot;
}

const TABS_COLOR = '#1d4ed8';

const fields: Fields<TabsPuckProps> = {
  children: { type: 'slot', allow: ['Tab'] },
};

export const tabsConfig: ComponentConfig<TabsPuckProps> = {
  label: 'Tabs',
  fields,
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <EditorChrome label="Tabs" color={TABS_COLOR}>
      <Children />
    </EditorChrome>
  ),
};
