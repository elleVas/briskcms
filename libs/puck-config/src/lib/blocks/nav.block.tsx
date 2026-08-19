import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import {
  navPropsSchema,
  type NavProps,
  type Visibility,
} from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';
import { visibilityField } from '../fields/visibility-field.js';

export { navPropsSchema, type NavProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `NavProps` (the domain schema, docs/adr/0018): at the domain level nested
// content lives in `Block.children`, not in `props` — this Puck-only type
// is what apps/editor-app's puck-data-mapper.ts reads to know which field
// to extract into `children` when converting back. Standalone, not
// `extends NavProps` — see hamburger-menu.block.tsx's own comment for why.
export interface NavPuckProps {
  visibility: Visibility;
  children: Slot;
}

const NAV_COLOR = '#7c3aed';

const fields: Fields<NavPuckProps> = {
  visibility: visibilityField,
  children: {
    type: 'slot',
    allow: ['NavLink', 'LanguageSwitcher', 'HamburgerMenu'],
  },
};

export const navConfig: ComponentConfig<NavPuckProps> = {
  label: 'Menu di navigazione',
  fields,
  defaultProps: { visibility: 'always', children: [] },
  // `style` on the slot's own render function is Puck's documented way to
  // style the actual drop-zone container (DropZoneProps["style"]) — a flex
  // row here is what makes a child's own `position: 'right'` prop (see
  // nav-link.block.tsx/language-switcher.block.tsx/hamburger-menu.block.tsx)
  // able to push itself to the far side via margin-left: auto.
  render: ({ children: Children }) => (
    <EditorChrome label="Menu di navigazione" color={NAV_COLOR}>
      <nav>
        <Children
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        />
      </nav>
    </EditorChrome>
  ),
};
