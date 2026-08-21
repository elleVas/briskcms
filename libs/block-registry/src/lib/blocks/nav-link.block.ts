import type { NavLinkProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { linkTypeField } from '../fields/link-type-field.js';
import { PagePickerField } from '../fields/page-picker-field.js';
import { positionField } from '../fields/position-field.js';
import { visibilityField } from '../fields/visibility-field.js';

export const navLinkBlock: BlockDescriptor<NavLinkProps> = {
  type: 'NavLink',
  label: 'Link di navigazione',
  category: 'navigation',
  defaultProps: {
    label: 'Link',
    linkType: 'page',
    page: null,
    url: '',
    position: 'left',
    visibility: 'always',
  },
  fields: [
    { kind: 'text', key: 'label', label: 'Testo', inlineEditable: true },
    linkTypeField,
    customField('page', 'Pagina', PagePickerField),
    { kind: 'text', key: 'url', label: 'URL' },
    positionField,
    visibilityField,
  ],
};
