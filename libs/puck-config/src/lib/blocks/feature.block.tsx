import type { ComponentConfig } from '@puckeditor/core';
import { featurePropsSchema, type FeatureProps } from '@brisk/shared-types';

export { featurePropsSchema, type FeatureProps };

export const featureConfig: ComponentConfig<FeatureProps> = {
  label: 'Feature',
  fields: {
    icon: { type: 'text' },
    title: { type: 'text' },
    text: { type: 'textarea' },
  },
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
