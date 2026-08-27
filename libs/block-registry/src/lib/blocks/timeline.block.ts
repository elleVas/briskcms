import type { TimelineProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const timelineBlock: BlockDescriptor<TimelineProps> = {
  type: 'Timeline',
  label: 'blocks.timeline.label',
  category: 'socialProof',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['TimelineStep'],
  // Niente paddingX/paddingY: padding-left è strutturale in Timeline.astro.
  stylableProperties: ['backgroundColor', 'textColor', 'borderRadius'],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Timeline,
};
