const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export interface ColorPickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  /**
   * The RESOLVED value of the active theme for this field (docs/adr/0022's
   * follow-up on pre-fill) — `null`/absent = not loaded yet or no known
   * default. Shown as a preview when `value` isn't set, so the field
   * already starts from the current real appearance instead of being
   * empty. Not always a hex value (often `oklch(...)`, like this
   * project's theme tokens): `<input type="color">` only accepts hex, so
   * that stays black until it's a match; the preview swatch below
   * instead accepts any valid CSS color syntax.
   */
  defaultValue?: string | null;
}

/**
 * Per-instance color override — `null`/absent means "inherit from the
 * theme" (the block renderer only applies a CSS-var scoping wrapper when
 * this is non-empty). The check is a truthiness check, not `!== null`:
 * `value` can arrive as `undefined` (property never customized, so
 * absent from the sparse object), and `undefined !== null` is `true` in
 * JS — with `!== null` the "back to theme" button would show up even
 * without any real customization.
 */
export function ColorPickerField({
  value,
  onChange,
  defaultValue,
}: ColorPickerFieldProps) {
  const hexDefault =
    defaultValue && HEX_PATTERN.test(defaultValue) ? defaultValue : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={value ?? hexDefault ?? '#000000'}
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
      {!value && defaultValue && (
        <span
          aria-hidden="true"
          title={`Valore attuale del tema: ${defaultValue}`}
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            borderRadius: 3,
            border: '1px solid #d4d4d8',
            background: defaultValue,
          }}
        />
      )}
      <input
        type="text"
        value={value ?? ''}
        placeholder={
          defaultValue ? `Tema: ${defaultValue}` : 'Eredita dal tema'
        }
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
      {value && (
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
