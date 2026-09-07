import type { BeforeAfterProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';

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
      'media',
    ),
    FieldBuilder.custom(
      'afterImage',
      'blocks.beforeAfter.fields.afterImage.fieldLabel',
      'media',
    ),
    {
      kind: 'text',
      key: 'beforeLabel',
      translatable: true,
      label: 'blocks.beforeAfter.fields.beforeLabel.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'afterLabel',
      translatable: true,
      label: 'blocks.beforeAfter.fields.afterLabel.fieldLabel',
      inlineEditable: true,
    },
  ],
};
