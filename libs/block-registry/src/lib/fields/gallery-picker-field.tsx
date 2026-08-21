import type { PickedMedia } from '@brisk/shared-types';
import { useMediaPicker } from '../media-picker-context.js';

export interface GalleryImageItem {
  media: PickedMedia | null;
  alt: string;
}

export interface GalleryPickerFieldProps {
  value: GalleryImageItem[];
  onChange: (value: GalleryImageItem[]) => void;
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
};

/** Ogni slot (picker, alt text, rimuovi) è sempre visibile, nessuno step di espansione. */
export function GalleryPickerField({
  value,
  onChange,
}: GalleryPickerFieldProps) {
  const { pick } = useMediaPicker();

  async function handlePickAt(index: number) {
    const picked = await pick();
    if (!picked) return;
    const next = value.slice();
    next[index] = { ...next[index], media: picked };
    onChange(next);
  }

  function handleAltChange(index: number, alt: string) {
    const next = value.slice();
    next[index] = { ...next[index], alt };
    onChange(next);
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleAdd() {
    onChange([...value, { media: null, alt: '' }]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* No stable id per item — index as key va bene, le righe vengono solo aggiunte/rimosse qui, mai riordinate. */}
      {value.map((item, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 8,
            border: '1px solid #d4d4d8',
            borderRadius: 4,
          }}
        >
          {item.media && (
            <img
              src={item.media.url}
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
            onClick={() => void handlePickAt(index)}
            style={{ ...buttonStyle, alignSelf: 'flex-start' }}
          >
            {item.media ? 'Cambia immagine' : 'Scegli immagine'}
          </button>
          <input
            type="text"
            placeholder="Testo alternativo"
            value={item.alt}
            onChange={(event) => handleAltChange(index, event.target.value)}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => handleRemove(index)}
            style={{ ...buttonStyle, alignSelf: 'flex-start' }}
          >
            Rimuovi
          </button>
        </div>
      ))}
      <button type="button" onClick={handleAdd} style={buttonStyle}>
        Aggiungi immagine
      </button>
    </div>
  );
}
