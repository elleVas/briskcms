import type { BannerProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';
import { ctaLinkFields } from '../fields/link-type-field';

export const bannerBlock: BlockDescriptor<BannerProps> = {
  type: 'Banner',
  label: 'blocks.banner.label',
  category: 'conversion',
  defaultProps: {
    title: 'Titolo del banner',
    text: 'Testo del banner...',
    buttonLabel: 'Scopri di più',
    linkType: 'page',
    page: null,
    url: '',
  },
  fields: [
    {
      kind: 'text',
      key: 'title',
      label: 'blocks.banner.fields.title.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'textarea',
      key: 'text',
      label: 'blocks.banner.fields.text.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'buttonLabel',
      label: 'blocks.banner.fields.buttonLabel.fieldLabel',
      inlineEditable: true,
    },
    ...ctaLinkFields(),
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Banner,
};
