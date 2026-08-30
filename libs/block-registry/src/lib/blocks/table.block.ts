import type { TableProps } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { TableDataField } from '../fields/table-data-field';

export const tableBlock: BlockDescriptor<TableProps> = {
  type: 'Table',
  label: 'blocks.table.label',
  category: 'content',
  defaultProps: {
    rows: [
      ['Colonna 1', 'Colonna 2'],
      ['', ''],
    ],
  },
  fields: [
    FieldBuilder.custom(
      'rows',
      'blocks.table.fields.rows.fieldLabel',
      TableDataField,
    ),
  ],
};
