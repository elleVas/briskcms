import type { PromoBarProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';
import { ctaLinkFields } from '../fields/link-type-field';
import { visibilityField } from '../fields/visibility-field';

export const promoBarBlock: BlockDescriptor<PromoBarProps> = {
  type: 'PromoBar',
  label: 'blocks.promoBar.label',
  category: 'chrome',
  defaultProps: {
    message: 'Messaggio promozionale...',
    linkType: 'page',
    page: null,
    url: '',
    visibility: 'always',
  },
  fields: [
    {
      kind: 'textarea',
      key: 'message',
      label: 'blocks.promoBar.fields.message.fieldLabel',
      inlineEditable: true,
    },
    ...ctaLinkFields(),
    visibilityField,
  ],
  // Sostituisce il vecchio `colorOverride` — vedi button.block.ts.
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.PromoBar,
};
