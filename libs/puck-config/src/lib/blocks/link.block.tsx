import type { ComponentConfig, Fields } from '@puckeditor/core';
import { linkPropsSchema, type LinkProps } from '@brisk/shared-types';
import { PagePickerField } from '../fields/page-picker-field.js';
import { withInlineTextFallback } from '../fields/resolve-inline-text-fallback.js';

export { linkPropsSchema, type LinkProps };

const fields: Fields<LinkProps> = {
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
};

export const linkConfig: ComponentConfig<LinkProps> = {
  label: 'Link',
  fields,
  resolveFields: (_data, { parent }) => withInlineTextFallback(fields, parent),
  defaultProps: {
    label: 'Scopri di più',
    linkType: 'page',
    page: null,
    url: '',
  },
  render: ({ label, linkType, page }) => (
    <a
      href="#"
      onClick={(event) => event.preventDefault()}
      style={{ color: '#2563eb', textDecoration: 'underline' }}
    >
      {label}
      {linkType === 'page' && page ? ` → ${page.title}` : ''}
    </a>
  ),
};
