import type { PickedPage } from '@brisk/shared-types';
import { usePageList } from '../page-list-context.js';

export interface PagePickerFieldProps {
  value: PickedPage | null;
  onChange: (value: PickedPage | null) => void;
}

export function PagePickerField({ value, onChange }: PagePickerFieldProps) {
  const { pick } = usePageList();

  async function handlePick() {
    const picked = await pick();
    if (picked) onChange(picked);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value && <p style={{ margin: 0, fontSize: 14 }}>{value.title}</p>}
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
          alignSelf: 'flex-start',
        }}
      >
        {value ? 'Cambia pagina' : 'Scegli pagina'}
      </button>
    </div>
  );
}
