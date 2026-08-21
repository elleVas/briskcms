export interface TableDataFieldProps {
  value: string[][];
  onChange: (value: string[][]) => void;
}

const buttonStyle = {
  padding: '6px 12px',
  borderRadius: 4,
  border: '1px solid #d4d4d8',
  background: '#fff',
  color: '#18181b',
  font: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
};

const inputStyle = {
  padding: '6px 8px',
  borderRadius: 4,
  border: '1px solid #d4d4d8',
  background: '#fff',
  color: '#18181b',
  font: 'inherit',
  fontSize: 14,
  width: 120,
};

/** Ogni cella è un <input> sempre visibile, nessuna riga collassata da scoprire. La prima riga è sempre l'intestazione (content-model.ts's own comment). */
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
