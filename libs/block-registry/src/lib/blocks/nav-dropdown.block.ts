import type { NavDropdownProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { positionField } from '../fields/position-field';
import { visibilityField } from '../fields/visibility-field';

export const navDropdownBlock: BlockDescriptor<NavDropdownProps> = {
  type: 'NavDropdown',
  label: 'blocks.navDropdown.label',
  category: 'navigation',
  defaultProps: {
    label: 'Sottomenu',
    position: 'left',
    visibility: 'always',
  },
  fields: [
    {
      kind: 'text',
      key: 'label',
      translatable: true,
      label: 'blocks.navDropdown.fields.label.fieldLabel',
      inlineEditable: true,
    },
    positionField,
    visibilityField,
  ],
  // Capped at one level (docs/adr/0018 follow-up): only NavLink, not
  // another NavDropdown.
  isContainer: true,
  allowedChildTypes: ['NavLink'],
};
