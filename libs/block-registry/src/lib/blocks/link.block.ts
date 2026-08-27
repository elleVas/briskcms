import type { LinkProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { ctaLinkFields } from '../fields/link-type-field.js';

export const linkBlock: BlockDescriptor<LinkProps> = {
  type: 'Link',
  label: 'blocks.link.label',
  category: 'content',
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
      label: 'blocks.link.fields.label.fieldLabel',
      inlineEditable: true,
    },
    ...ctaLinkFields(),
  ],
};
