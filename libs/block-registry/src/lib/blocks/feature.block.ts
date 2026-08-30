import type { FeatureProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';
import { IconPickerField } from '../fields/icon-picker-field';

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
      IconPickerField,
    ),
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
