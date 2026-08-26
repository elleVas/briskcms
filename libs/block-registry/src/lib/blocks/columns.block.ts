import type { ColumnsProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';

export const columnsBlock: BlockDescriptor<ColumnsProps> = {
  type: 'Columns',
  label: 'Colonne',
  category: 'layout',
  defaultProps: { layout: 'two-equal' },
  fields: [
    {
      kind: 'radio',
      key: 'layout',
      label: 'Layout',
      options: [
        { label: '2 uguali', value: 'two-equal' },
        { label: '2 (30/70)', value: 'two-asymmetric' },
        { label: '3 uguali', value: 'three-equal' },
      ],
    },
  ],
  isContainer: true,
  allowedChildTypes: ['Column'],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Columns,
};
