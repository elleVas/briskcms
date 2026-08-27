import type { NavLinkProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types.js';
import { IconPickerField } from '../fields/icon-picker-field.js';
import { ctaLinkFields } from '../fields/link-type-field.js';
import { positionField } from '../fields/position-field.js';
import { visibilityField } from '../fields/visibility-field.js';

export const navLinkBlock: BlockDescriptor<NavLinkProps> = {
  type: 'NavLink',
  label: 'blocks.navLink.label',
  category: 'navigation',
  defaultProps: {
    label: 'Link',
    linkType: 'page',
    page: null,
    url: '',
    icon: null,
    position: 'left',
    visibility: 'always',
  },
  fields: [
    {
      kind: 'text',
      key: 'label',
      label: 'blocks.navLink.fields.label.fieldLabel',
      inlineEditable: true,
    },
    ...ctaLinkFields(),
    FieldBuilder.custom(
      'icon',
      'blocks.navLink.fields.icon.fieldLabel',
      IconPickerField,
    ),
    positionField,
    visibilityField,
  ],
};
