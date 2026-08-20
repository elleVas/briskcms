import type { ComponentConfig, Fields } from '@puckeditor/core';
import { bannerPropsSchema, type BannerProps } from '@brisk/shared-types';
import { PagePickerField } from '../fields/page-picker-field.js';
import { withInlineTextFallback } from '../fields/resolve-inline-text-fallback.js';

export { bannerPropsSchema, type BannerProps };

// Same "page or url" pattern as NavLink/PromoBar — both `page` and `url`
// always show up in the sidebar (Puck's `Fields<T>` requires every prop
// key), guided by the `linkType` radio for which one the editor actually
// fills in.
const fields: Fields<BannerProps> = {
  title: { type: 'text', contentEditable: true, visible: false },
  text: { type: 'textarea', contentEditable: true, visible: false },
  buttonLabel: { type: 'text', contentEditable: true, visible: false },
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
  backgroundColor: { type: 'text' },
};

export const bannerConfig: ComponentConfig<BannerProps> = {
  label: 'Banner/CTA',
  fields,
  resolveFields: (_data, { parent }) => withInlineTextFallback(fields, parent),
  defaultProps: {
    title: 'Titolo del banner',
    text: 'Testo del banner...',
    buttonLabel: 'Scopri di più',
    linkType: 'page',
    page: null,
    url: '',
    backgroundColor: '#f4f4f5',
  },
  render: ({ title, text, buttonLabel, linkType, page, backgroundColor }) => (
    <div
      style={{
        background: backgroundColor,
        padding: 24,
        borderRadius: 8,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 8 }}>{text}</div>
      <button
        type="button"
        style={{
          marginTop: 16,
          padding: '8px 16px',
          borderRadius: 6,
          border: 'none',
          background: '#18181b',
          color: '#fff',
        }}
      >
        {buttonLabel}
        {linkType === 'page' && page ? ` → ${page.title}` : ''}
      </button>
    </div>
  ),
};
