import type { PickedMedia } from '@brisk/shared-types';
import { useMediaPicker } from '../media-picker-context.js';

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
            border: '1px solid var(--puck-color-border, #d4d4d8)',
          }}
        />
      )}
      {/* Puck's own Fields panel doesn't expose a public "button" style for
          custom fields (only CSS-module classes internal to Puck, which
          aren't a stable API to depend on) — styled by hand via Puck's own
          public --puck-color-* tokens instead, so it reads as an actual
          button (border/background/padding) rather than bare unstyled
          text, and still follows the app's light/dark theme like every
          other field around it. */}
      <button
        type="button"
        onClick={() => void handlePick()}
        style={{
          padding: '6px 12px',
          borderRadius: 4,
          border: '1px solid var(--puck-color-border, #d4d4d8)',
          background: 'var(--puck-color-surface, #fff)',
          color: 'var(--puck-color-text, #18181b)',
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
