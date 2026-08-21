import type { ComponentConfig, Fields } from '@puckeditor/core';
import { buttonPropsSchema, type ButtonProps } from '@brisk/shared-types';
import { ColorPickerField } from '../fields/color-picker-field.js';
import { PagePickerField } from '../fields/page-picker-field.js';
import { createResolveFields } from '../fields/resolve-inline-text-fallback.js';

export { buttonPropsSchema, type ButtonProps };

const fields: Fields<ButtonProps> = {
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
  variant: {
    type: 'radio',
    options: [
      { label: 'Primario', value: 'primary' },
      { label: 'Secondario', value: 'secondary' },
    ],
  },
  colorOverride: {
    type: 'custom',
    label: 'Colore personalizzato (sovrascrive il tema)',
    render: ({ value, onChange }) => (
      <ColorPickerField value={value} onChange={onChange} />
    ),
  },
};

export const buttonConfig: ComponentConfig<ButtonProps> = {
  label: 'Bottone (CTA)',
  fields,
  resolveFields: createResolveFields(fields),
  defaultProps: {
    label: 'Scopri di più',
    linkType: 'page',
    page: null,
    url: '',
    variant: 'primary',
    colorOverride: null,
  },
  render: ({ label, linkType, page, variant, colorOverride }) => {
    const accent = colorOverride ?? '#18181b';
    return (
      <button
        type="button"
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          border: variant === 'secondary' ? `1px solid ${accent}` : 'none',
          background: variant === 'secondary' ? 'transparent' : accent,
          color: variant === 'secondary' ? accent : '#fff',
        }}
      >
        {label}
        {linkType === 'page' && page ? ` → ${page.title}` : ''}
      </button>
    );
  },
};
