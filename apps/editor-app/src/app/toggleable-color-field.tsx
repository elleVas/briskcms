import { Label } from '../components/ui/label.js';

export interface ToggleableColorFieldProps {
  id: string;
  label: string;
  overrideLabel: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Un colore opzionale: una checkbox "Personalizza" più un color-picker nativo
 * (visibile solo se abilitato) — usato sia da StyleView (impostazioni tema
 * a livello di sito) sia da GlobalStylesDialog (stesso concetto, aperto
 * dalla barra in alto dell'editor). Estratto qui perché lo stesso identico
 * blocco compariva già due volte in StyleView (primario/secondario) prima
 * di aggiungerne un terzo/quarto uso.
 */
export function ToggleableColorField({
  id,
  label,
  overrideLabel,
  enabled,
  onEnabledChange,
  value,
  onValueChange,
}: ToggleableColorFieldProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          {overrideLabel}
        </label>
      </div>
      {enabled && (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="color"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            className="h-9 w-14 rounded border border-input bg-transparent"
          />
          <span className="text-xs text-muted-foreground">{value}</span>
        </div>
      )}
    </div>
  );
}
