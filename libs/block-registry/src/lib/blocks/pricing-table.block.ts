import type { PricingTableProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const pricingTableBlock: BlockDescriptor<PricingTableProps> = {
  type: 'PricingTable',
  label: 'blocks.pricingTable.label',
  category: 'socialProof',
  defaultProps: { display: 'grid' },
  fields: [
    {
      kind: 'select',
      key: 'display',
      label: 'blocks.shared.display.fieldLabel',
      options: [
        {
          label: 'blocks.shared.display.options.grid',
          value: 'grid',
        },
        {
          label: 'blocks.shared.display.options.slider',
          value: 'slider',
        },
        {
          label: 'blocks.shared.display.options.carousel',
          value: 'carousel',
        },
      ],
    },
  ],
  isContainer: true,
  allowedChildTypes: ['PricingPlan'],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.PricingTable,
};
