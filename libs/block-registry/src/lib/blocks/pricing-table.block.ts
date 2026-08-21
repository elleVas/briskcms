import type { PricingTableProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const pricingTableBlock: BlockDescriptor<PricingTableProps> = {
  type: 'PricingTable',
  label: 'Tabella prezzi',
  category: 'socialProof',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['PricingPlan'],
};
