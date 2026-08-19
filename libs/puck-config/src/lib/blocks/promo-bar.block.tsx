import type { ComponentConfig, Fields } from '@puckeditor/core';
import { promoBarPropsSchema, type PromoBarProps } from '@brisk/shared-types';
import { PagePickerField } from '../fields/page-picker-field.js';
import { visibilityField } from '../fields/visibility-field.js';

export { promoBarPropsSchema, type PromoBarProps };

// Both `page` and `url` always show up in the sidebar (same reasoning as
// nav-link.block.tsx's own fields), guided by the `linkType` radio for
// which one the editor is actually meant to fill in.
const fields: Fields<PromoBarProps> = {
  message: { type: 'textarea' },
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
  visibility: visibilityField,
};

export const promoBarConfig: ComponentConfig<PromoBarProps> = {
  label: 'Barra annuncio/promo',
  fields,
  defaultProps: {
    message: 'Messaggio promozionale...',
    linkType: 'page',
    page: null,
    url: '',
    visibility: 'always',
  },
  render: ({ message, linkType, page }) => (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 16px',
        background: '#fde68a',
        textAlign: 'center',
      }}
    >
      {message}
      {linkType === 'page' && page ? ` → ${page.title}` : ''}
    </div>
  ),
};
