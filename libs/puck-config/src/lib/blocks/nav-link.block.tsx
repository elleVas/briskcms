import type { ComponentConfig, Fields } from '@puckeditor/core';
import { navLinkPropsSchema, type NavLinkProps } from '@brisk/shared-types';
import { PagePickerField } from '../fields/page-picker-field.js';

export { navLinkPropsSchema, type NavLinkProps };

// Both `page` and `url` always show up in the sidebar (Puck's `Fields<T>`
// requires every prop key — resolveFields can't return a subset, only
// swap what each field *is*), guided by the `linkType` radio for which
// one the editor is actually meant to fill in.
const fields: Fields<NavLinkProps> = {
  label: { type: 'text' },
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
};

export const navLinkConfig: ComponentConfig<NavLinkProps> = {
  label: 'Link di navigazione',
  fields,
  defaultProps: {
    label: 'Link',
    linkType: 'page',
    page: null,
    url: '',
  },
  render: ({ label, linkType, page }) => (
    <span>
      {label}
      {linkType === 'page' && page ? ` → ${page.title}` : ''}
    </span>
  ),
};
