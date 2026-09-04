import { Label } from '../components/ui/label';

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
 * An optional colour: a "Customize" checkbox plus a native colour picker
 * (shown only when enabled) — used both by StyleView (site-level theme
 * settings) and by GlobalStylesDialog (the same concept, opened from the
 * editor's top bar). Extracted here because the exact same block already
 * appeared twice in StyleView (primary/secondary) before a third and
 * fourth use were added.
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
