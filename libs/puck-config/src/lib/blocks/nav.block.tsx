import type { ComponentConfig, Slot } from '@puckeditor/core';
import { navPropsSchema, type NavProps } from '@brisk/shared-types';

export { navPropsSchema, type NavProps };

// See header.block.tsx's own comment on why this Puck-only type differs
// from NavProps (the domain schema).
export interface NavPuckProps {
  children: Slot;
}

export const navConfig: ComponentConfig<NavPuckProps> = {
  label: 'Menu di navigazione',
  fields: {
    children: { type: 'slot', allow: ['NavLink', 'LanguageSwitcher'] },
  },
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <nav>
      <Children />
    </nav>
  ),
};
