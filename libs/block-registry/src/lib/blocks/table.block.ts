import type { TableProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { TableDataField } from '../fields/table-data-field.js';

export const tableBlock: BlockDescriptor<TableProps> = {
  type: 'Table',
  label: 'Tabella dati',
  category: 'content',
  defaultProps: {
    rows: [
      ['Colonna 1', 'Colonna 2'],
      ['', ''],
    ],
  },
  fields: [customField('rows', 'Righe', TableDataField)],
};
