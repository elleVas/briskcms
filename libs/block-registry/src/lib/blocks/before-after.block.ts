import type { BeforeAfterProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { MediaPickerField } from '../fields/media-picker-field';

export const beforeAfterBlock: BlockDescriptor<BeforeAfterProps> = {
  type: 'BeforeAfter',
  label: 'blocks.beforeAfter.label',
  category: 'media',
  defaultProps: {
    beforeImage: null,
    afterImage: null,
    beforeLabel: 'Prima',
    afterLabel: 'Dopo',
  },
  fields: [
    FieldBuilder.custom(
      'beforeImage',
      'blocks.beforeAfter.fields.beforeImage.fieldLabel',
      MediaPickerField,
    ),
    FieldBuilder.custom(
      'afterImage',
      'blocks.beforeAfter.fields.afterImage.fieldLabel',
      MediaPickerField,
    ),
    {
      kind: 'text',
      key: 'beforeLabel',
      label: 'blocks.beforeAfter.fields.beforeLabel.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'afterLabel',
      label: 'blocks.beforeAfter.fields.afterLabel.fieldLabel',
      inlineEditable: true,
    },
  ],
};
