import type { LinkProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { linkTypeField } from '../fields/link-type-field.js';
import { PagePickerField } from '../fields/page-picker-field.js';

export const linkBlock: BlockDescriptor<LinkProps> = {
  type: 'Link',
  label: 'Link',
  category: 'content',
  defaultProps: {
    label: 'Scopri di più',
    linkType: 'page',
    page: null,
    url: '',
  },
  fields: [
    { kind: 'text', key: 'label', label: 'Testo', inlineEditable: true },
    linkTypeField,
    customField('page', 'Pagina', PagePickerField),
    { kind: 'text', key: 'url', label: 'URL' },
  ],
};
