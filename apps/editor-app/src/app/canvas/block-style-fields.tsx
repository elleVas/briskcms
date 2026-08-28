import { ColorPickerField } from '@brisk/block-registry';
import type {
  BlockStyleDefaults,
  BlockStyleOverride,
} from '@brisk/shared-types';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { useTranslation } from '../../lib/use-translation.js';

export interface BlockStyleFieldsProps {
  /** `BlockDescriptor.stylableProperties` del tipo selezionato — decide quali campi mostrare, nello stesso ordine (docs/adr/0022). */
  properties: readonly (keyof BlockStyleOverride)[];
  value: BlockStyleOverride;
  onChange: (next: BlockStyleOverride) => void;
  /**
   * Il valore RISOLTO del tema attivo per ogni proprietà (docs/adr/0022's
   * follow-up), da `GET /api/themes/current/block-style-defaults` — così
   * i campi partono già dall'aspetto reale attuale invece che vuoti.
   * Assente/`undefined` = non ancora caricato (mostra il placeholder
   * generico com'era prima), non un errore.
   */
  defaults?: BlockStyleDefaults;
}

const COLOR_FIELD_LABELS: Partial<Record<keyof BlockStyleOverride, string>> = {
  backgroundColor: 'canvas.blockStyle.colors.backgroundColor',
  textColor: 'canvas.blockStyle.colors.textColor',
};

const LENGTH_FIELD_LABELS: Partial<
  Record<keyof BlockStyleOverride, { label: string; placeholder: string }>
> = {
  borderRadius: {
    label: 'canvas.blockStyle.lengths.borderRadius.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.borderRadius.placeholder',
  },
  paddingX: {
    label: 'canvas.blockStyle.lengths.paddingX.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.paddingX.placeholder',
  },
  paddingY: {
    label: 'canvas.blockStyle.lengths.paddingY.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.paddingY.placeholder',
  },
  marginTop: {
    label: 'canvas.blockStyle.lengths.marginTop.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.marginTop.placeholder',
  },
  marginBottom: {
    label: 'canvas.blockStyle.lengths.marginBottom.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.marginBottom.placeholder',
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
  defaults,
}: BlockStyleFieldsProps) {
  const { tLabel } = useTranslation();
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
              <Label>{tLabel(colorLabel)}</Label>
              <ColorPickerField
                value={(value[property] as string | null | undefined) ?? null}
                onChange={(next) => setField(property, next)}
                defaultValue={defaults?.[property]}
              />
            </div>
          );
        }
        const lengthField = LENGTH_FIELD_LABELS[property];
        if (lengthField) {
          return (
            <div key={property} className="flex flex-col gap-1.5">
              <Label htmlFor={`block-style-${property}`}>
                {tLabel(lengthField.label)}
              </Label>
              <Input
                id={`block-style-${property}`}
                value={(value[property] as string | null | undefined) ?? ''}
                placeholder={
                  defaults?.[property] ?? tLabel(lengthField.placeholder)
                }
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
