import { ColorPickerField } from './custom-fields/color-picker-field';
import type {
  BlockStyleDefaults,
  BlockStyleOverride,
  ThemeBaseTokens,
  ThemeStyleProperty,
} from '@brisk/shared-types';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useTranslation } from '../../lib/use-translation';

export interface BlockStyleFieldsProps {
  /** The selected type's `BlockDescriptor.stylableProperties` — decides which fields to show, in that order (docs/adr/0022). Since ADR-0047 it may name a property a THEME added, which core has never heard of. */
  properties: readonly string[];
  /** The block type these properties belong to, only so a theme property can find its label at `blocks.<type>.styleProperties.<key>`. */
  blockType: string;
  /** What the active theme declared for the properties core does not ship (ADR-0047) — which control to draw, and the options a select offers. Absent = this theme added none. */
  themeProperties?: readonly ThemeStyleProperty[];
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
  /**
   * The active theme's own colour vocabulary (ADR-0050), offered as
   * swatches by every colour control below. Picking one stores
   * `var(--primary)` rather than the hex it currently resolves to, so the
   * block keeps following the theme.
   *
   * Absent = no swatch row; the fields still work, they just cannot offer
   * the theme's colours.
   */
  themeTokens?: ThemeBaseTokens | null;
}

const COLOR_FIELD_LABELS: Partial<Record<keyof BlockStyleOverride, string>> = {
  backgroundColor: 'canvas.blockStyle.colors.backgroundColor',
  textColor: 'canvas.blockStyle.colors.textColor',
  borderColor: 'canvas.blockStyle.colors.borderColor',
  overlayColor: 'canvas.blockStyle.colors.overlayColor',
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
  borderWidth: {
    label: 'canvas.blockStyle.lengths.borderWidth.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.borderWidth.placeholder',
  },
  minHeight: {
    label: 'canvas.blockStyle.lengths.minHeight.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.minHeight.placeholder',
  },
  maxWidth: {
    label: 'canvas.blockStyle.lengths.maxWidth.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.maxWidth.placeholder',
  },
  gap: {
    label: 'canvas.blockStyle.lengths.gap.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.gap.placeholder',
  },
  // A CSS value rather than a length, but the control is the same box and
  // the placeholder is what tells you so — `var(--shadow-md)` for one,
  // `url(...)` for the other.
  boxShadow: {
    label: 'canvas.blockStyle.lengths.boxShadow.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.boxShadow.placeholder',
  },
  backgroundImage: {
    label: 'canvas.blockStyle.lengths.backgroundImage.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.backgroundImage.placeholder',
  },
  // Durations (docs/adr/0060) — a text box, because "600ms" and "0.6s"
  // are both right and a menu of fixed steps would be the thing an
  // agency matching a design cannot use. The schema refuses a bare
  // number, which is the mistake that actually happens.
  animationDuration: {
    label: 'canvas.blockStyle.lengths.animationDuration.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.animationDuration.placeholder',
  },
  animationDelay: {
    label: 'canvas.blockStyle.lengths.animationDelay.fieldLabel',
    placeholder: 'canvas.blockStyle.lengths.animationDelay.placeholder',
  },
};

/**
 * Closed sets get a menu, not a text box: there is one right answer per
 * option and no way to mistype it. The values are the CSS keywords
 * themselves, so nothing has to translate between what is stored and what
 * is rendered.
 */
const SELECT_FIELD_OPTIONS: Partial<
  Record<keyof BlockStyleOverride, readonly string[]>
> = {
  borderStyle: ['none', 'solid', 'dashed', 'dotted'],
  backgroundPosition: ['center', 'top', 'bottom', 'left', 'right'],
  backgroundSize: ['cover', 'contain', 'auto'],
  backgroundRepeat: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'],
  contentAlign: ['start', 'center', 'end'],
  contentJustify: ['start', 'center', 'end'],
  flexDirection: ['column', 'row'],
  // docs/adr/0060. `none` is first and is what every block already does,
  // so the menu opens on "no animation" rather than on one somebody has
  // to undo.
  animation: [
    'none',
    'fade',
    'slide-up',
    'slide-down',
    'slide-left',
    'slide-right',
    'zoom',
  ],
  animationEasing: ['ease-out', 'ease', 'ease-in', 'ease-in-out', 'linear'],
  hoverEffect: ['none', 'lift', 'grow', 'dim'],
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
  blockType,
  themeProperties,
  value,
  onChange,
  defaults,
  themeTokens,
}: BlockStyleFieldsProps) {
  const { tLabel } = useTranslation();
  function setField(key: string, fieldValue: string | null) {
    onChange({ ...value, [key]: fieldValue });
  }

  /**
   * Core's own maps are keyed by its property names; a theme's property is
   * in none of them, so `Partial<Record<...>>` cannot be indexed by an
   * arbitrary string without this. A lookup that returns `undefined` for
   * an unknown key is exactly the behaviour the code below already
   * expects — the maps were only ever probed, never exhausted.
   */
  const coreLabel = <T,>(
    map: Partial<Record<keyof BlockStyleOverride, T>>,
    key: string,
  ): T | undefined => (map as Partial<Record<string, T>>)[key];

  const read = (key: string): string | null | undefined => {
    const current = (value as Record<string, unknown>)[key];
    return typeof current === 'string' ? current : null;
  };

  const themePropertyByKey = new Map(
    (themeProperties ?? []).map((property) => [property.key, property]),
  );
  const themeLabelKey = (key: string) =>
    `blocks.${blockType.charAt(0).toLowerCase()}${blockType.slice(1)}.styleProperties.${key}`;

  return (
    <div className="flex flex-col gap-3">
      {properties.map((property) => {
        const colorLabel = coreLabel(COLOR_FIELD_LABELS, property);
        if (colorLabel) {
          return (
            <div key={property} className="flex flex-col gap-1.5">
              <Label>{tLabel(colorLabel)}</Label>
              <ColorPickerField
                value={read(property) ?? null}
                onChange={(next) => setField(property, next)}
                defaultValue={coreLabel(defaults ?? {}, property)}
                themeTokens={themeTokens}
              />
            </div>
          );
        }
        const lengthField = coreLabel(LENGTH_FIELD_LABELS, property);
        if (lengthField) {
          return (
            <div key={property} className="flex flex-col gap-1.5">
              <Label htmlFor={`block-style-${property}`}>
                {tLabel(lengthField.label)}
              </Label>
              <Input
                id={`block-style-${property}`}
                value={read(property) ?? ''}
                placeholder={
                  coreLabel(defaults ?? {}, property) ??
                  tLabel(lengthField.placeholder)
                }
                onChange={(event) => {
                  const next = event.target.value;
                  setField(property, next.trim() === '' ? null : next);
                }}
              />
            </div>
          );
        }
        const options = coreLabel(SELECT_FIELD_OPTIONS, property);
        if (options) {
          return (
            <div key={property} className="flex flex-col gap-1.5">
              <Label htmlFor={`block-style-${property}`}>
                {tLabel(`canvas.blockStyle.selects.${property}.fieldLabel`)}
              </Label>
              <select
                id={`block-style-${property}`}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={read(property) ?? ''}
                onChange={(event) =>
                  setField(
                    property,
                    event.target.value === ''
                      ? null
                      : (event.target.value as never),
                  )
                }
              >
                {/* The theme's own value, not a value of its own: leaving
                    it selected is how you say "do not override this". */}
                <option value="">
                  {tLabel('canvas.blockStyle.selects.inherit')}
                </option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {tLabel(
                      `canvas.blockStyle.selects.${property}.options.${option}`,
                    )}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        // A property core has never heard of: the THEME said which control
        // to draw (ADR-0047), and its label was registered into i18next on
        // arrival. Last, so a core property can never be shadowed by a
        // theme's — each theme's own spec refuses that clash, and the
        // order here says so too.
        const themeProperty = themePropertyByKey.get(property);
        if (themeProperty) {
          const label = tLabel(themeLabelKey(property));
          if (themeProperty.control === 'color') {
            return (
              <div key={property} className="flex flex-col gap-1.5">
                <Label>{label}</Label>
                <ColorPickerField
                  value={read(property) ?? null}
                  onChange={(next) => setField(property, next)}
                  themeTokens={themeTokens}
                />
              </div>
            );
          }
          if (themeProperty.control === 'select') {
            return (
              <div key={property} className="flex flex-col gap-1.5">
                <Label htmlFor={`block-style-${property}`}>{label}</Label>
                <select
                  id={`block-style-${property}`}
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                  value={read(property) ?? ''}
                  onChange={(event) =>
                    setField(property, event.target.value || null)
                  }
                >
                  <option value="">
                    {tLabel('canvas.blockStyle.selects.inherit')}
                  </option>
                  {(themeProperty.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          return (
            <div key={property} className="flex flex-col gap-1.5">
              <Label htmlFor={`block-style-${property}`}>{label}</Label>
              <Input
                id={`block-style-${property}`}
                value={read(property) ?? ''}
                placeholder={themeProperty.placeholder}
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
