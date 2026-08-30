import type { ColumnProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types';
import { BlockStyleRegistry } from '../block-style-registry';

// Nessuna allowedChildTypes — una Colonna è pensata per contenere qualunque
// cosa serva alla pagina fianco a fianco con le sue sorelle, stessa
// ragione del Contenitore.
export const columnBlock: BlockDescriptor<ColumnProps> = {
  type: 'Column',
  label: 'blocks.column.label',
  category: 'layout',
  defaultProps: {},
  fields: [],
  isContainer: true,
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Column,
};
