import type { NavLinkProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { IconPickerField } from '../fields/icon-picker-field';
import { ctaLinkFields } from '../fields/link-type-field';
import { positionField } from '../fields/position-field';
import { visibilityField } from '../fields/visibility-field';

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
      translatable: true,
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
