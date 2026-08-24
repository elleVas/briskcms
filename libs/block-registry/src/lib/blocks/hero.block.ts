import type { HeroProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const heroBlock: BlockDescriptor<HeroProps> = {
  type: 'Hero',
  label: 'Hero',
  category: 'content',
  defaultProps: {
    title: 'Titolo',
    subtitle: 'Sottotitolo',
  },
  fields: [
    { kind: 'text', key: 'title', label: 'Titolo', inlineEditable: true },
    {
      kind: 'textarea',
      key: 'subtitle',
      label: 'Sottotitolo',
      inlineEditable: true,
    },
  ],
  stylableProperties: ['backgroundColor', 'textColor', 'borderRadius'],
};
