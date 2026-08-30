import type { ColumnsProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const columnsBlock: BlockDescriptor<ColumnsProps> = {
  type: 'Columns',
  label: 'blocks.columns.label',
  category: 'layout',
  defaultProps: { layout: 'two-equal' },
  fields: [
    {
      kind: 'radio',
      key: 'layout',
      label: 'blocks.columns.fields.layout.fieldLabel',
      options: [
        {
          label: 'blocks.columns.fields.layout.options.twoEqual',
          value: 'two-equal',
        },
        {
          label: 'blocks.columns.fields.layout.options.twoAsymmetric',
          value: 'two-asymmetric',
        },
        {
          label: 'blocks.columns.fields.layout.options.threeEqual',
          value: 'three-equal',
        },
      ],
    },
  ],
  isContainer: true,
  allowedChildTypes: ['Column'],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Columns,
};
