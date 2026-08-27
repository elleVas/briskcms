import type { FeatureGridProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';

export const featureGridBlock: BlockDescriptor<FeatureGridProps> = {
  type: 'FeatureGrid',
  label: 'blocks.featureGrid.label',
  category: 'interactive',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['Feature'],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.FeatureGrid,
};
