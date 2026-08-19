import type { ComponentConfig, Slot } from '@puckeditor/core';
import { headerPropsSchema, type HeaderProps } from '@brisk/shared-types';

export { headerPropsSchema, type HeaderProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `HeaderProps` (the domain schema, docs/adr/0018): at the domain level
// nested content lives in `Block.children`, not in `props` — this
// Puck-only type is what apps/editor-app's puck-data-mapper.ts reads to
// know which field to extract into `children` when converting back.
export interface HeaderPuckProps {
  children: Slot;
}

export const headerConfig: ComponentConfig<HeaderPuckProps> = {
  label: 'Header',
  fields: {
    children: { type: 'slot', allow: ['Nav', 'Text', 'Image'] },
  },
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <header>
      <Children />
    </header>
  ),
};
