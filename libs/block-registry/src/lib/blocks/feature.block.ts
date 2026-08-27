import type { FeatureProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';

export const featureBlock: BlockDescriptor<FeatureProps> = {
  type: 'Feature',
  label: 'blocks.feature.label',
  category: 'interactive',
  defaultProps: {
    icon: '🚀',
    title: 'Titolo della feature',
    text: 'Descrizione della feature...',
  },
  fields: [
    {
      kind: 'text',
      key: 'icon',
      label: 'blocks.feature.fields.icon.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'title',
      label: 'blocks.feature.fields.title.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'textarea',
      key: 'text',
      label: 'blocks.feature.fields.text.fieldLabel',
      inlineEditable: true,
    },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Feature,
};
