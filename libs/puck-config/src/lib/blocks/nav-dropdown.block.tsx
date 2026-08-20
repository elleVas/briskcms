import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import {
  navDropdownPropsSchema,
  type NavDropdownProps,
  type Visibility,
} from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';
import { positionField } from '../fields/position-field.js';
import { createResolveFields } from '../fields/resolve-inline-text-fallback.js';
import { visibilityField } from '../fields/visibility-field.js';

export { navDropdownPropsSchema, type NavDropdownProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `NavDropdownProps` (the domain schema) — see nav.block.tsx's own
// comment for why this Puck-only type differs from the domain schema.
export interface NavDropdownPuckProps {
  label: string;
  position: 'left' | 'right';
  visibility: Visibility;
  children: Slot;
}

const NAV_DROPDOWN_COLOR = '#0891b2';

const fields: Fields<NavDropdownPuckProps> = {
  label: { type: 'text', contentEditable: true, visible: false },
  position: positionField,
  visibility: visibilityField,
  // Capped at one level (docs/adr/0018 follow-up): only `NavLink`, not
  // another `NavDropdown` — see the domain schema's own comment for why.
  children: { type: 'slot', allow: ['NavLink'] },
};

export const navDropdownConfig: ComponentConfig<NavDropdownPuckProps> = {
  label: 'Sottomenu',
  fields,
  resolveFields: createResolveFields(fields),
  defaultProps: {
    label: 'Sottomenu',
    position: 'left',
    visibility: 'always',
    children: [],
  },
  render: ({ label, children: Children }) => (
    <EditorChrome label="Sottomenu" color={NAV_DROPDOWN_COLOR}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{label} ▾</div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <Children />
      </div>
    </EditorChrome>
  ),
};
