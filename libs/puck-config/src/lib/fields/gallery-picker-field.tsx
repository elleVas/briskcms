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
};

// Puck's own ArrayField renders each item collapsed by default, with no
// public option to start expanded (checked the installed @puckeditor/core
// types) — clicking a summary row to reveal the picker button turned out
// to be undiscoverable enough that it read as "can't select images at
// all". A hand-built list sidesteps that entirely: every slot's picker,
// alt text, and remove control are always visible, no expand step.
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
      {/* No stable id per item — index as key is fine, rows are only ever
          appended/removed here, never reordered. */}
      {value.map((item, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 8,
            border: '1px solid var(--puck-color-border, #d4d4d8)',
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
                border: '1px solid var(--puck-color-border, #d4d4d8)',
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
