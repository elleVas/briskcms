export interface TableDataFieldProps {
  value: string[][];
  onChange: (value: string[][]) => void;
}

const buttonStyle = {
  padding: '6px 12px',
  borderRadius: 4,
  border: '1px solid var(--puck-color-border, #d4d4d8)',
  background: 'var(--puck-color-surface, #fff)',
  color: 'var(--puck-color-text, #18181b)',
  font: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
};

const inputStyle = {
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid var(--puck-color-border, #d4d4d8)',
  background: 'var(--puck-color-surface, #fff)',
  color: 'var(--puck-color-text, #18181b)',
  font: 'inherit',
  fontSize: 14,
  width: 120,
};

// Puck has no native grid/table field — same problem gallery-picker-field
// solved for a list of images, solved here for a 2D matrix instead: every
// cell is an always-visible <input>, no collapsed/summary row to discover.
// The first row is always the header row (content-model.ts's own comment
// on tablePropsSchema) — "Rimuovi ultima colonna" removes the last column
// from every row rather than exposing per-column remove controls, the
// same "keep it as simple as the list case" call gallery-picker-field made
// for "no reordering, index as key".
export function TableDataField({ value, onChange }: TableDataFieldProps) {
  const columnCount = value[0]?.length ?? 0;

  function handleCellChange(rowIndex: number, colIndex: number, cell: string) {
    const next = value.map((row) => row.slice());
    next[rowIndex][colIndex] = cell;
    onChange(next);
  }

  function handleAddRow() {
    onChange([...value, new Array<string>(columnCount).fill('')]);
  }

  function handleRemoveRow(rowIndex: number) {
    onChange(value.filter((_, i) => i !== rowIndex));
  }

  function handleAddColumn() {
    onChange(value.map((row) => [...row, '']));
  }

  function handleRemoveColumn() {
    onChange(value.map((row) => row.slice(0, -1)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.map((row, rowIndex) => (
        <div
          key={rowIndex}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {row.map((cell, colIndex) => (
            <input
              key={colIndex}
              type="text"
              placeholder={
                rowIndex === 0 ? `Colonna ${colIndex + 1}` : undefined
              }
              value={cell}
              onChange={(event) =>
                handleCellChange(rowIndex, colIndex, event.target.value)
              }
              style={inputStyle}
            />
          ))}
          <button
            type="button"
            onClick={() => handleRemoveRow(rowIndex)}
            disabled={value.length <= 1}
            style={buttonStyle}
          >
            Rimuovi riga
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={handleAddRow} style={buttonStyle}>
          Aggiungi riga
        </button>
        <button type="button" onClick={handleAddColumn} style={buttonStyle}>
          Aggiungi colonna
        </button>
        <button
          type="button"
          onClick={handleRemoveColumn}
          disabled={columnCount <= 1}
          style={buttonStyle}
        >
          Rimuovi ultima colonna
        </button>
      </div>
    </div>
  );
}
