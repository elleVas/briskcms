const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export interface ColorPickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * Per-instance color override — `null` significa "eredita dal tema" (il
 * block renderer applica un wrapper di scoping via CSS-var solo quando
 * questo è non-null).
 */
export function ColorPickerField({ value, onChange }: ColorPickerFieldProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={value ?? '#000000'}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: 36,
          height: 28,
          padding: 0,
          border: '1px solid #d4d4d8',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      />
      <input
        type="text"
        value={value ?? ''}
        placeholder="Eredita dal tema"
        onChange={(event) => {
          const next = event.target.value;
          if (next === '') {
            onChange(null);
          } else if (HEX_PATTERN.test(next)) {
            onChange(next);
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          padding: '6px 8px',
          borderRadius: 4,
          border: '1px solid #d4d4d8',
          background: '#fff',
          color: '#18181b',
          font: 'inherit',
          fontSize: 13,
        }}
      />
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Torna al colore del tema"
          style={{
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid #d4d4d8',
            background: '#fff',
            color: '#18181b',
            font: 'inherit',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
