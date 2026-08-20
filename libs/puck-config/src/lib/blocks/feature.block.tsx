import type { ComponentConfig, Fields } from '@puckeditor/core';
import { featurePropsSchema, type FeatureProps } from '@brisk/shared-types';
import { withInlineTextFallback } from '../fields/resolve-inline-text-fallback.js';

export { featurePropsSchema, type FeatureProps };

const fields: Fields<FeatureProps> = {
  // Not contentEditable: a short emoji glyph is closer to an attribute
  // pick than prose content — stays in the sidebar.
  icon: { type: 'text' },
  title: { type: 'text', contentEditable: true, visible: false },
  text: { type: 'textarea', contentEditable: true, visible: false },
};

export const featureConfig: ComponentConfig<FeatureProps> = {
  label: 'Feature',
  fields,
  resolveFields: (_data, { parent }) => withInlineTextFallback(fields, parent),
  defaultProps: {
    icon: '🚀',
    title: 'Titolo della feature',
    text: 'Descrizione della feature...',
  },
  render: ({ icon, title, text }) => (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div style={{ fontWeight: 600, marginTop: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#71717a', marginTop: 4 }}>{text}</div>
    </div>
  ),
};
