import { BLOCK_STYLE_DEFAULTS, type DividerProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';

// No fields at all, and that is the design (ADR-0053): thickness, colour,
// style, width and the space around it are style properties already, per
// breakpoint. A `style` prop beside a `borderStyle` override would be the
// two-mechanisms mistake ADR-0050 found in Container.
export const dividerBlock: BlockDescriptor<DividerProps> = {
  type: 'Divider',
  label: 'blocks.divider.label',
  category: 'layout',
  defaultProps: {},
  fields: [],
  stylableProperties: [
    'borderWidth',
    'borderStyle',
    'borderColor',
    'maxWidth',
    'marginTop',
    'marginBottom',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Divider,
};
