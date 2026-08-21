import type { ColumnProps } from '@brisk/shared-types';
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
};
