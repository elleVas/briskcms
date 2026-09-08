import { BLOCK_STYLE_DEFAULTS, type SliderProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

// No allowedChildTypes — the point of this block is that it holds
// anything, the same reasoning as Container and Column. A collection with
// a fixed child type answers the other half of the need (ADR-0052).
export const sliderBlock: BlockDescriptor<SliderProps> = {
  type: 'Slider',
  label: 'blocks.slider.label',
  category: 'layout',
  defaultProps: { display: 'carousel' },
  fields: [
    {
      kind: 'select',
      key: 'display',
      label: 'blocks.shared.display.fieldLabel',
      options: [
        { label: 'blocks.shared.display.options.carousel', value: 'carousel' },
        { label: 'blocks.shared.display.options.slider', value: 'slider' },
        { label: 'blocks.shared.display.options.grid', value: 'grid' },
      ],
    },
  ],
  isContainer: true,
  stylableProperties: [...BlockStyleRegistry.STANDARD, 'gap'],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Slider,
};
