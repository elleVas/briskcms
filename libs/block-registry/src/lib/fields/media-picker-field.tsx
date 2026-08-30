import type { PickedMedia } from '@brisk/shared-types';
import { useMediaPicker } from '../media-picker-context';

export interface MediaPickerFieldProps {
  value: PickedMedia | null;
  onChange: (value: PickedMedia | null) => void;
}

export function MediaPickerField({ value, onChange }: MediaPickerFieldProps) {
  const { pick } = useMediaPicker();

  async function handlePick() {
    const picked = await pick();
    if (picked) onChange(picked);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value && (
        <img
          src={value.url}
          alt=""
          style={{
            maxWidth: '100%',
            borderRadius: 4,
            border: '1px solid #d4d4d8',
          }}
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
          alignSelf: 'flex-start',
        }}
      >
        {value ? 'Cambia immagine' : 'Scegli immagine'}
      </button>
    </div>
  );
}
