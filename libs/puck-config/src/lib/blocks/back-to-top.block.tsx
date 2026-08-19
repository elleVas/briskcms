import type { ComponentConfig, Fields } from '@puckeditor/core';
import { backToTopPropsSchema, type BackToTopProps } from '@brisk/shared-types';
import { visibilityField } from '../fields/visibility-field.js';

export { backToTopPropsSchema, type BackToTopProps };

const fields: Fields<BackToTopProps> = {
  visibility: visibilityField,
};

// A static circular button is enough to recognize and position the block
// while composing the header/footer — the real scroll-triggered show/hide
// and smooth-scroll-to-top only exist on apps/public-site
// (BackToTop.astro), same split as HamburgerMenu's static editor preview
// vs. its real open/close behavior on the public site.
export const backToTopConfig: ComponentConfig<BackToTopProps> = {
  label: 'Bottone "torna su"',
  fields,
  defaultProps: {
    visibility: 'always',
  },
  render: () => (
    <button
      type="button"
      aria-label="Torna su"
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: 'none',
        background: '#18181b',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        cursor: 'default',
      }}
    >
      ↑
    </button>
  ),
};
