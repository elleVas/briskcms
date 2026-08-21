import type { FeatureGridProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const featureGridBlock: BlockDescriptor<FeatureGridProps> = {
  type: 'FeatureGrid',
  label: 'Feature grid',
  category: 'interactive',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['Feature'],
};
