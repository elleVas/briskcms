import type { StatProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';
import { BlockStyleRegistry } from '../block-style-registry.js';

export const statBlock: BlockDescriptor<StatProps> = {
  type: 'Stat',
  label: 'Statistica',
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
    { kind: 'number', key: 'value', label: 'Valore' },
    { kind: 'text', key: 'prefix', label: 'Prefisso', inlineEditable: true },
    { kind: 'text', key: 'suffix', label: 'Suffisso', inlineEditable: true },
    { kind: 'text', key: 'label', label: 'Etichetta', inlineEditable: true },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Stat,
};
