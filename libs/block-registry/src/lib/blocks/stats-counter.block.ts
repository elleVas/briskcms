import type { StatsCounterProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';

export const statsCounterBlock: BlockDescriptor<StatsCounterProps> = {
  type: 'StatsCounter',
  label: 'blocks.statsCounter.label',
  category: 'socialProof',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['Stat'],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.StatsCounter,
};
