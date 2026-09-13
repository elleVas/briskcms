import type { PricingTableProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';
import { displayField } from '../fields/display-field';

export const pricingTableBlock: BlockDescriptor<PricingTableProps> = {
  type: 'PricingTable',
  label: 'blocks.pricingTable.label',
  category: 'socialProof',
  icon: 'receipt',
  defaultProps: { display: 'grid' },
  fields: [displayField],
  isContainer: true,
  allowedChildTypes: ['PricingPlan'],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.PricingTable,
};
