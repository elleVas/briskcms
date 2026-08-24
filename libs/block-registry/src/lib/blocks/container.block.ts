import type { ContainerProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const containerBlock: BlockDescriptor<ContainerProps> = {
  type: 'Container',
  label: 'Contenitore',
  category: 'layout',
  defaultProps: { background: 'none', padding: 'md' },
  fields: [
    {
      kind: 'radio',
      key: 'background',
      label: 'Sfondo',
      options: [
        { label: 'Nessuno', value: 'none' },
        { label: 'Tenue', value: 'muted' },
        { label: 'Primario', value: 'primary' },
        { label: 'Secondario', value: 'secondary' },
      ],
    },
    {
      kind: 'radio',
      key: 'padding',
      label: 'Padding',
      options: [
        { label: 'Nessuno', value: 'none' },
        { label: 'Piccolo', value: 'sm' },
        { label: 'Medio', value: 'md' },
        { label: 'Grande', value: 'lg' },
      ],
    },
  ],
  // Nessuna allowedChildTypes — a differenza di Column (lista fissa per
  // un track di griglia), un Contenitore è pensato per contenere
  // qualunque cosa, incluso un altro Contenitore o Colonne.
  isContainer: true,
  // Solo radius e colore testo: background/padding hanno già i propri
  // campi dedicati sopra, non vanno duplicati qui.
  stylableProperties: ['textColor', 'borderRadius'],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Container,
};
