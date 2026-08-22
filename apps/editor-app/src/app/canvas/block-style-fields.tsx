import { ColorPickerField } from '@brisk/block-registry';
import type { BlockStyleOverride } from '@brisk/shared-types';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';

export interface BlockStyleFieldsProps {
  /** `BlockDescriptor.stylableProperties` del tipo selezionato — decide quali campi mostrare, nello stesso ordine (docs/adr/0022). */
  properties: (keyof BlockStyleOverride)[];
  value: BlockStyleOverride;
  onChange: (next: BlockStyleOverride) => void;
}

const COLOR_FIELD_LABELS: Partial<Record<keyof BlockStyleOverride, string>> = {
  backgroundColor: 'Colore di sfondo',
  textColor: 'Colore testo',
};

const LENGTH_FIELD_LABELS: Partial<
  Record<keyof BlockStyleOverride, { label: string; placeholder: string }>
> = {
  borderRadius: {
    label: 'Raggio angoli',
    placeholder: 'es. 6px, 9999px per un pill',
  },
  paddingX: {
    label: 'Padding orizzontale',
    placeholder: 'es. 1.25rem — vuoto per il default',
  },
  paddingY: {
    label: 'Padding verticale',
    placeholder: 'es. 1.25rem — vuoto per il default',
  },
};

/**
 * Gruppo di campi condiviso da ENTRAMBI i popover di stile (docs/adr/0022)
 * — "Stile" nella toolbar (override per-tipo, scrive su
 * `site.themeTokens.blockStyles`) e il popover per-istanza (scrive su
 * `Block.styleOverride`): stessa UI, stesso shape `BlockStyleOverride`,
 * cambia solo DOVE il chiamante salva il risultato. Mostra solo i campi
 * che `descriptor.stylableProperties` dichiara rilevanti per quel tipo —
 * un Testo non offre "raggio angoli", un Button offre tutti e cinque.
 */
export function BlockStyleFields({
  properties,
  value,
  onChange,
}: BlockStyleFieldsProps) {
  function setField<K extends keyof BlockStyleOverride>(
    key: K,
    fieldValue: BlockStyleOverride[K],
  ) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <div className="flex flex-col gap-3">
      {properties.map((property) => {
        const colorLabel = COLOR_FIELD_LABELS[property];
        if (colorLabel) {
          return (
            <div key={property} className="flex flex-col gap-1.5">
              <Label>{colorLabel}</Label>
              <ColorPickerField
                value={(value[property] as string | null | undefined) ?? null}
                onChange={(next) => setField(property, next)}
              />
            </div>
          );
        }
        const lengthField = LENGTH_FIELD_LABELS[property];
        if (lengthField) {
          return (
            <div key={property} className="flex flex-col gap-1.5">
              <Label htmlFor={`block-style-${property}`}>
                {lengthField.label}
              </Label>
              <Input
                id={`block-style-${property}`}
                value={(value[property] as string | null | undefined) ?? ''}
                placeholder={lengthField.placeholder}
                onChange={(event) => {
                  const next = event.target.value;
                  setField(property, next.trim() === '' ? null : next);
                }}
              />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
