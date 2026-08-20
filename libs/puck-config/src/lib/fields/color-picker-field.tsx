const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export interface ColorPickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * Per-instance color override — `null` means "inherit the theme" (the
 * block's own `render()` only applies a CSS-var scoping wrapper when this
 * is non-null, see e.g. button.block.tsx). First color-picker field in
 * this codebase; Banner's `backgroundColor` predates this as a plain text
 * field (its own comment says so) — worth migrating to this once this
 * pattern is proven out, not done here to keep this change scoped.
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
          border: '1px solid var(--puck-color-border, #d4d4d8)',
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
          border: '1px solid var(--puck-color-border, #d4d4d8)',
          background: 'var(--puck-color-surface, #fff)',
          color: 'var(--puck-color-text, #18181b)',
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
            border: '1px solid var(--puck-color-border, #d4d4d8)',
            background: 'var(--puck-color-surface, #fff)',
            color: 'var(--puck-color-text, #18181b)',
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
