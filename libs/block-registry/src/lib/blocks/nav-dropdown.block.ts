import type { NavDropdownProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { positionField } from '../fields/position-field.js';
import { visibilityField } from '../fields/visibility-field.js';

export const navDropdownBlock: BlockDescriptor<NavDropdownProps> = {
  type: 'NavDropdown',
  label: 'Sottomenu',
  category: 'navigation',
  defaultProps: {
    label: 'Sottomenu',
    position: 'left',
    visibility: 'always',
  },
  fields: [
    { kind: 'text', key: 'label', label: 'Etichetta', inlineEditable: true },
    positionField,
    visibilityField,
  ],
  // Capped a un livello (docs/adr/0018 follow-up): solo NavLink, non un
  // altro NavDropdown.
  isContainer: true,
  allowedChildTypes: ['NavLink'],
};
