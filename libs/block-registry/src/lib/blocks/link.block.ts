import type { LinkProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { ctaLinkFields } from '../fields/link-type-field';

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
      translatable: true,
      label: 'blocks.link.fields.label.fieldLabel',
      inlineEditable: true,
    },
    ...ctaLinkFields(),
  ],
};
