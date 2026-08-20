import type { ComponentConfig, Fields } from '@puckeditor/core';
import { navLinkPropsSchema, type NavLinkProps } from '@brisk/shared-types';
import { PagePickerField } from '../fields/page-picker-field.js';
import { positionField } from '../fields/position-field.js';
import { visibilityField } from '../fields/visibility-field.js';

export { navLinkPropsSchema, type NavLinkProps };

// Both `page` and `url` always show up in the sidebar (Puck's `Fields<T>`
// requires every prop key — resolveFields can't return a subset, only
// swap what each field *is*), guided by the `linkType` radio for which
// one the editor is actually meant to fill in.
const fields: Fields<NavLinkProps> = {
  label: { type: 'text', contentEditable: true, visible: false },
  linkType: {
    type: 'radio',
    options: [
      { label: 'Pagina del sito', value: 'page' },
      { label: 'URL esterno', value: 'url' },
    ],
  },
  page: {
    type: 'custom',
    render: ({ value, onChange }) => (
      <PagePickerField value={value} onChange={onChange} />
    ),
  },
  url: { type: 'text' },
  position: positionField,
  visibility: visibilityField,
};

export const navLinkConfig: ComponentConfig<NavLinkProps> = {
  label: 'Link di navigazione',
  fields,
  defaultProps: {
    label: 'Link',
    linkType: 'page',
    page: null,
    url: '',
    position: 'left',
    visibility: 'always',
  },
  // `marginLeft: auto` on itself (not a container-level layout prop) is
  // what actually pushes a "right"-positioned item across the Nav's flex
  // row (nav.block.tsx) — the standard CSS technique for splitting a flex
  // row by individual item, not a whole-row alignment toggle.
  render: ({ label, linkType, page, position }) => (
    <span style={{ marginLeft: position === 'right' ? 'auto' : undefined }}>
      {label}
      {linkType === 'page' && page ? ` → ${page.title}` : ''}
    </span>
  ),
};
