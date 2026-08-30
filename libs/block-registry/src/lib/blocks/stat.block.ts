import type { StatProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

export const statBlock: BlockDescriptor<StatProps> = {
  type: 'Stat',
  label: 'blocks.stat.label',
  category: 'socialProof',
  defaultProps: {
    value: 100,
    prefix: '',
    suffix: '',
    label: 'Etichetta',
  },
  fields: [
    // Non inlineEditable: guida l'animazione count-up sul sito pubblico
    // (StatsCounter.astro la fa il parse diretto), deve restare un numero.
    {
      kind: 'number',
      key: 'value',
      label: 'blocks.stat.fields.value.fieldLabel',
    },
    {
      kind: 'text',
      key: 'prefix',
      label: 'blocks.stat.fields.prefix.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'suffix',
      label: 'blocks.stat.fields.suffix.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'label',
      label: 'blocks.stat.fields.label.fieldLabel',
      inlineEditable: true,
    },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Stat,
};
