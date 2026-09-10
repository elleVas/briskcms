import type { FeatureGridProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const featureGridBlock: BlockDescriptor<FeatureGridProps> = {
  type: 'FeatureGrid',
  label: 'blocks.featureGrid.label',
  category: 'interactive',
  icon: 'grid-3x3',
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
  allowedChildTypes: ['Feature'],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.FeatureGrid,
};
