import type { StatsCounterProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const statsCounterBlock: BlockDescriptor<StatsCounterProps> = {
  type: 'StatsCounter',
  label: 'blocks.statsCounter.label',
  category: 'socialProof',
  icon: 'chart-column',
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
  allowedChildTypes: ['Stat'],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.StatsCounter,
};
