import type { NavDropdownProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { positionField } from '../fields/position-field.js';
import { visibilityField } from '../fields/visibility-field.js';

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
      label: 'blocks.navDropdown.fields.label.fieldLabel',
      inlineEditable: true,
    },
    positionField,
    visibilityField,
  ],
  // Capped a un livello (docs/adr/0018 follow-up): solo NavLink, non un
  // altro NavDropdown.
  isContainer: true,
  allowedChildTypes: ['NavLink'],
};
