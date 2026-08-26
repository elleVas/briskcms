import type { BannerProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';
import { ctaLinkFields } from '../fields/link-type-field.js';

export const bannerBlock: BlockDescriptor<BannerProps> = {
  type: 'Banner',
  label: 'Banner/CTA',
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
    { kind: 'text', key: 'title', label: 'Titolo', inlineEditable: true },
    { kind: 'textarea', key: 'text', label: 'Testo', inlineEditable: true },
    {
      kind: 'text',
      key: 'buttonLabel',
      label: 'Testo bottone',
      inlineEditable: true,
    },
    ...ctaLinkFields(),
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Banner,
};
