/*
 * The design system's own classes, not literal hex values (Fase 7).
 * These fields used to carry `background: '#fff'` and `color: '#18181b'`
 * inline, which is a white box with near-black text — correct in the light
 * theme and unreadable in the dark one, where the panel around them is
 * dark. A class reads the same tokens every other control does.
 */
const buttonClass =
  'inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted';
const inputClass =
  'h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export interface TableDataFieldProps {
  value: string[][];
  onChange: (value: string[][]) => void;
}

/** Every cell is an always-visible <input>, no collapsed row to discover. The first row is always the header (content-model.ts's own comment). */
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
              className={inputClass}
            />
          ))}
          <button
            type="button"
            onClick={() => handleRemoveRow(rowIndex)}
            disabled={value.length <= 1}
            className={buttonClass}
          >
            Rimuovi riga
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={handleAddRow} className={buttonClass}>
          Aggiungi riga
        </button>
        <button type="button" onClick={handleAddColumn} className={buttonClass}>
          Aggiungi colonna
        </button>
        <button
          type="button"
          onClick={handleRemoveColumn}
          disabled={columnCount <= 1}
          className={buttonClass}
        >
          Rimuovi ultima colonna
        </button>
      </div>
    </div>
  );
}
