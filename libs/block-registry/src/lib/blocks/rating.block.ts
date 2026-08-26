import type { RatingProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';

export const ratingBlock: BlockDescriptor<RatingProps> = {
  type: 'Rating',
  label: 'Valutazione a stelle',
  category: 'media',
  defaultProps: {
    rating: 5,
    label: 'Valutazione clienti',
  },
  fields: [
    { kind: 'number', key: 'rating', label: 'Stelle', min: 1, max: 5, step: 1 },
    { kind: 'text', key: 'label', label: 'Etichetta', inlineEditable: true },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Rating,
};
