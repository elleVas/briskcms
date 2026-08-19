import type { ComponentConfig, Slot } from '@puckeditor/core';
import { footerPropsSchema, type FooterProps } from '@brisk/shared-types';

export { footerPropsSchema, type FooterProps };

// See header.block.tsx's own comment on why this Puck-only type differs
// from FooterProps (the domain schema).
export interface FooterPuckProps {
  children: Slot;
}

export const footerConfig: ComponentConfig<FooterPuckProps> = {
  label: 'Footer',
  fields: {
    // No Hero/Gallery/Form here, unlike Header's Nav/Text/Image — a
    // footer's realistic content is text/links/a small image, not the
    // heavier blocks a hero section needs.
    children: {
      type: 'slot',
      allow: ['Text', 'Image', 'NavLink', 'LanguageSwitcher'],
    },
  },
  defaultProps: { children: [] },
  render: ({ children: Children }) => (
    <footer>
      <Children />
    </footer>
  ),
};
