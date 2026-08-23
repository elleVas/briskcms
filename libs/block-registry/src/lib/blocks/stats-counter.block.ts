import type { StatsCounterProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const statsCounterBlock: BlockDescriptor<StatsCounterProps> = {
  type: 'StatsCounter',
  label: 'Contatori/statistiche',
  category: 'socialProof',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['Stat'],
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
};
