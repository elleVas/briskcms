import type { ButtonProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';
import { ctaLinkFields } from '../fields/link-type-field';

export const buttonBlock: BlockDescriptor<ButtonProps> = {
  type: 'Button',
  label: 'blocks.button.label',
  category: 'conversion',
  defaultProps: {
    label: 'Scopri di più',
    linkType: 'page',
    page: null,
    url: '',
  },
  fields: [
    {
      kind: 'text',
      key: 'label',
      translatable: true,
      label: 'blocks.button.fields.label.fieldLabel',
      inlineEditable: true,
    },
    ...ctaLinkFields(),
  ],
  // Was a `kind: 'radio'` prop until ADR-0047. It is the same two looks,
  // declared where a look belongs: `Block.variant` rather than the block's
  // content, so a theme can add a third without editing anyone's pages.
  variants: [{ value: 'secondary', label: 'blocks.button.variants.secondary' }],
  // Color/borders/padding — editable for ALL Buttons on the site (the
  // "Style" button in the toolbar) or only for this instance (popover on
  // the selected block), docs/adr/0022. Replaces the old `colorOverride`.
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Button,
};
