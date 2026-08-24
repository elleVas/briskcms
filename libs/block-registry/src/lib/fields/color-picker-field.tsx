const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export interface ColorPickerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  /**
   * Il valore RISOLTO del tema attivo per questo campo (docs/adr/0022's
   * follow-up sul pre-fill) — `null`/assente = non ancora caricato o
   * nessun default noto. Mostrato come anteprima quando `value` non è
   * impostato, così il campo parte già dall'aspetto reale attuale invece
   * che vuoto. Non sempre un hex (spesso `oklch(...)`, come i token dei
   * temi di questo progetto): `<input type="color">` accetta solo hex,
   * quindi quello resta nero finché non è un match; il quadratino di
   * anteprima sotto invece accetta qualunque sintassi colore CSS valida.
   */
  defaultValue?: string | null;
}

/**
 * Per-instance color override — `null`/assente significa "eredita dal
 * tema" (il block renderer applica un wrapper di scoping via CSS-var solo
 * quando questo è non-vuoto). Il controllo è un check di verità, non
 * `!== null`: `value` può arrivare `undefined` (proprietà mai
 * personalizzata, quindi assente dall'oggetto sparso), e `undefined !==
 * null` è `true` in JS — con `!== null` il pulsante "torna al tema"
 * comparirebbe anche senza nessuna personalizzazione reale.
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
