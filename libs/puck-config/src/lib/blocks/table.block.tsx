import type { ComponentConfig } from '@puckeditor/core';
import { tablePropsSchema, type TableProps } from '@brisk/shared-types';
import { TableDataField } from '../fields/table-data-field.js';

export { tablePropsSchema, type TableProps };

export const tableConfig: ComponentConfig<TableProps> = {
  label: 'Tabella dati',
  fields: {
    rows: {
      type: 'custom',
      render: ({ value, onChange }) => (
        <TableDataField value={value} onChange={onChange} />
      ),
    },
  },
  defaultProps: {
    rows: [
      ['Colonna 1', 'Colonna 2'],
      ['', ''],
    ],
  },
  render: ({ rows }) => {
    const [header, ...body] = rows;
    return (
      <table>
        {header && (
          <thead>
            <tr>
              {header.map((cell, colIndex) => (
                <th key={colIndex}>{cell}</th>
              ))}
            </tr>
          </thead>
        )}
        {body.length > 0 && (
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => (
                  <td key={colIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    );
  },
};
