import type { PickedForm } from '@brisk/shared-types';
import { useFormList } from '../form-list-context.js';

export interface FormPickerFieldProps {
  value: PickedForm | null;
  onChange: (value: PickedForm | null) => void;
}

export function FormPickerField({ value, onChange }: FormPickerFieldProps) {
  const { pick } = useFormList();

  async function handlePick() {
    const picked = await pick();
    if (picked) onChange(picked);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value && <p style={{ margin: 0, fontSize: 14 }}>{value.formName}</p>}
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
        {value ? 'Cambia modulo' : 'Scegli modulo'}
      </button>
    </div>
  );
}
