import type { ComponentConfig, Fields } from '@puckeditor/core';
import { promoBarPropsSchema, type PromoBarProps } from '@brisk/shared-types';
import { ColorPickerField } from '../fields/color-picker-field.js';
import { PagePickerField } from '../fields/page-picker-field.js';
import { visibilityField } from '../fields/visibility-field.js';
import { createResolveFields } from '../fields/resolve-inline-text-fallback.js';

export { promoBarPropsSchema, type PromoBarProps };

// Both `page` and `url` always show up in the sidebar (same reasoning as
// nav-link.block.tsx's own fields), guided by the `linkType` radio for
// which one the editor is actually meant to fill in.
const fields: Fields<PromoBarProps> = {
  message: { type: 'textarea', contentEditable: true, visible: false },
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
  colorOverride: {
    type: 'custom',
    label: 'Colore personalizzato (sovrascrive il tema)',
    render: ({ value, onChange }) => (
      <ColorPickerField value={value} onChange={onChange} />
    ),
  },
};

export const promoBarConfig: ComponentConfig<PromoBarProps> = {
  label: 'Barra annuncio/promo',
  fields,
  resolveFields: createResolveFields(fields),
  defaultProps: {
    message: 'Messaggio promozionale...',
    linkType: 'page',
    page: null,
    url: '',
    visibility: 'always',
    colorOverride: null,
  },
  render: ({ message, linkType, page, colorOverride }) => (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 16px',
        background: colorOverride ?? '#fde68a',
        textAlign: 'center',
      }}
    >
      {message}
      {linkType === 'page' && page ? ` → ${page.title}` : ''}
    </div>
  ),
};
