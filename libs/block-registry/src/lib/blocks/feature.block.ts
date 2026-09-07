import type { FeatureProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const featureBlock: BlockDescriptor<FeatureProps> = {
  type: 'Feature',
  label: 'blocks.feature.label',
  category: 'interactive',
  defaultProps: {
    icon: null,
    title: 'Titolo della feature',
    text: 'Descrizione della feature...',
  },
  fields: [
    FieldBuilder.custom(
      'icon',
      'blocks.feature.fields.icon.fieldLabel',
      'icon',
    ),
    {
      kind: 'text',
      key: 'title',
      translatable: true,
      label: 'blocks.feature.fields.title.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'richtext',
      key: 'text',
      translatable: true,
      label: 'blocks.feature.fields.text.fieldLabel',
      inlineEditable: true,
    },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Feature,
};
