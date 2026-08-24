import type { FeatureProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const featureBlock: BlockDescriptor<FeatureProps> = {
  type: 'Feature',
  label: 'Feature',
  category: 'interactive',
  defaultProps: {
    icon: '🚀',
    title: 'Titolo della feature',
    text: 'Descrizione della feature...',
  },
  fields: [
    { kind: 'text', key: 'icon', label: 'Icona (emoji)', inlineEditable: true },
    { kind: 'text', key: 'title', label: 'Titolo', inlineEditable: true },
    { kind: 'textarea', key: 'text', label: 'Testo', inlineEditable: true },
  ],
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
};
