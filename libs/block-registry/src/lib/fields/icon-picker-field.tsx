import { useIconList } from '../icon-list-context';

export interface IconPickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function IconPickerField({ value, onChange }: IconPickerFieldProps) {
  const { pick, resolve } = useIconList();
  const svg = value ? resolve(value) : null;

  async function handlePick() {
    const picked = await pick();
    if (picked) onChange(picked);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {svg && (
        <span
          aria-hidden="true"
          style={{ width: 20, height: 20, flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      <button
        type="button"
        onClick={() => void handlePick()}
        style={{
          padding: '6px 12px',
          borderRadius: 4,
          border: '1px solid #d4d4d8',
          background: '#fff',
          color: '#18181b',
          font: 'inherit',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        {value ? 'Cambia icona' : 'Scegli icona'}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Rimuovi icona"
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
