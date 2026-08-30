import type { HeroProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';

export const heroBlock: BlockDescriptor<HeroProps> = {
  type: 'Hero',
  label: 'blocks.hero.label',
  category: 'content',
  defaultProps: {
    title: 'Titolo',
    subtitle: 'Sottotitolo',
  },
  fields: [
    {
      kind: 'text',
      key: 'title',
      label: 'blocks.hero.fields.title.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'textarea',
      key: 'subtitle',
      label: 'blocks.hero.fields.subtitle.fieldLabel',
      inlineEditable: true,
    },
  ],
  stylableProperties: ['backgroundColor', 'textColor', 'borderRadius'],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Hero,
};
