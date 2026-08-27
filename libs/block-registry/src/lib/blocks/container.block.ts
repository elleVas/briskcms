import type { ContainerProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const containerBlock: BlockDescriptor<ContainerProps> = {
  type: 'Container',
  label: 'blocks.container.label',
  category: 'layout',
  defaultProps: { background: 'none', padding: 'md' },
  fields: [
    {
      kind: 'radio',
      key: 'background',
      label: 'blocks.container.fields.background.fieldLabel',
      options: [
        {
          label: 'blocks.container.fields.background.options.none',
          value: 'none',
        },
        {
          label: 'blocks.container.fields.background.options.muted',
          value: 'muted',
        },
        {
          label: 'blocks.container.fields.background.options.primary',
          value: 'primary',
        },
        {
          label: 'blocks.container.fields.background.options.secondary',
          value: 'secondary',
        },
      ],
    },
    {
      kind: 'radio',
      key: 'padding',
      label: 'blocks.container.fields.padding.fieldLabel',
      options: [
        {
          label: 'blocks.container.fields.padding.options.none',
          value: 'none',
        },
        {
          label: 'blocks.container.fields.padding.options.sm',
          value: 'sm',
        },
        {
          label: 'blocks.container.fields.padding.options.md',
          value: 'md',
        },
        {
          label: 'blocks.container.fields.padding.options.lg',
          value: 'lg',
        },
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
