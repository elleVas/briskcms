import type { ColumnProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

// Nessuna allowedChildTypes — una Colonna è pensata per contenere qualunque
// cosa serva alla pagina fianco a fianco con le sue sorelle, stessa
// ragione del Contenitore.
export const columnBlock: BlockDescriptor<ColumnProps> = {
  type: 'Column',
  label: 'Colonna',
  category: 'layout',
  defaultProps: {},
  fields: [],
  isContainer: true,
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Column,
};
