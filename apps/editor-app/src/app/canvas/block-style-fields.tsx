import { ColorPickerField } from '@brisk/block-registry';
import type {
  BlockStyleDefaults,
  BlockStyleOverride,
} from '@brisk/shared-types';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useTranslation } from '../../lib/use-translation';

export interface BlockStyleFieldsProps {
  /** `BlockDescriptor.stylableProperties` del tipo selezionato — decide quali campi mostrare, nello stesso ordine (docs/adr/0022). */
  properties: readonly (keyof BlockStyleOverride)[];
  value: BlockStyleOverride;
  onChange: (next: BlockStyleOverride) => void;
  /**
   * The active theme's RESOLVED value for each property (docs/adr/0022's
   * follow-up), from `GET /api/themes/current/block-style-defaults` — so
   * the fields start from the real current appearance rather than empty.
   * Absent/`undefined` = not loaded yet (showing the generic placeholder as
   * before), not an error.
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
 * The field group shared by BOTH style popovers (docs/adr/0022) — "Style"
 * in the toolbar (the per-type override, writing to
 * `site.themeTokens.blockStyles`) and the per-instance popover (writing to
 * `Block.styleOverride`): the same UI, the same `BlockStyleOverride` shape,
 * with only WHERE the caller saves the result differing. It shows only the
 * fields `descriptor.stylableProperties` declares relevant for that type —
 * a Text offers no "corner radius", a Button offers all five.
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
