import type { Block, BlockAlign } from '@brisk/shared-types';
import { CUSTOM_FIELD_CONTROLS } from './custom-fields/custom-field-controls';
import { RichTextField } from './custom-fields/rich-text-field';
import type { BlockDescriptor, FieldDescriptor } from '@brisk/block-registry';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { useTranslation } from '../../lib/use-translation';

export interface InspectorPanelProps {
  block: Block;
  descriptor: BlockDescriptor;
  onChangeProp: (key: string, value: unknown) => void;
  /** Picking one of the type's declared looks (ADR-0047). `undefined` = the type's own default. */
  onChangeVariant: (variant: string | undefined) => void;
  /**
   * How much page width this block claims (ADR-0049). Absent for a nested
   * block: a block inside a Container or a Column is laid out by whatever
   * holds it, so the control would promise something the page cannot do.
   */
  onChangeAlign?: (align: BlockAlign | undefined) => void;
}

const ALIGN_OPTIONS: readonly BlockAlign[] = ['content', 'wide', 'full'];

interface FieldRowProps {
  field: FieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}

const nativeFieldClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** One input per kind — a panel driven by the field descriptor, replacing Puck's Fields<T> sidebar (docs/adr/0007, see the visual editor plan, Day 3). */
function FieldRow({ field, value, onChange }: FieldRowProps) {
  const { tLabel } = useTranslation();
  switch (field.kind) {
    case 'text':
      return (
        <Input
          type="text"
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'textarea':
      return (
        <Textarea
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'richtext':
      return (
        <RichTextField
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          className={nativeFieldClass}
          value={typeof value === 'number' ? value : ''}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      );
    case 'boolean':
      return (
        <input
          type="checkbox"
          className="size-4 rounded border-input"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
      );
    case 'radio':
    case 'select':
      return (
        <select
          className={nativeFieldClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {tLabel(option.label)}
            </option>
          ))}
        </select>
      );
    case 'custom': {
      // The descriptor names a control; the map is what knows how to draw
      // it. See custom-field-controls.tsx for why that indirection exists.
      const Custom = CUSTOM_FIELD_CONTROLS[field.control];
      return <Custom value={value} onChange={onChange} />;
    }
  }
}

/**
 * A soft nudge, never a save/publish blocker (see docs/adr for the
 * alt-text accessibility gap this exists for) — `requiredUnless` lets a
 * sibling boolean prop (e.g. "isDecorative") waive it legitimately,
 * instead of every empty value being flagged as an oversight.
 */
function isRequiredFieldEmpty(
  field: FieldDescriptor,
  props: Record<string, unknown>,
): boolean {
  if (
    field.kind !== 'text' &&
    field.kind !== 'textarea' &&
    field.kind !== 'richtext'
  ) {
    return false;
  }
  if (!field.required) return false;
  if (field.requiredUnless && props[field.requiredUnless]) return false;
  const value = props[field.key];
  return typeof value !== 'string' || value.trim().length === 0;
}

/**
 * Replaces Puck's Fields<T> panel (docs/adr/0007) — one input per field,
 * driven by the selected block's `BlockDescriptor`. `inlineEditable` has no
 * effect here yet (mounting TipTap on the canvas is Day 4): for now every
 * field, textual or not, is editable only from here, which the plan already
 * guarantees as the real fallback.
 */
export function InspectorPanel({
  block,
  descriptor,
  onChangeProp,
  onChangeVariant,
  onChangeAlign,
}: InspectorPanelProps) {
  const { t, tLabel } = useTranslation();
  const variants = descriptor.variants ?? [];
  // Not `fields.length === 0`: a type may offer a look and no fields at
  // all, and returning null there would hide the only control it has —
  // width included, which every root block has whether or not its type
  // declares a single field.
  if (
    descriptor.fields.length === 0 &&
    variants.length === 0 &&
    !onChangeAlign
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{tLabel(descriptor.label)}</h3>
      {variants.length > 0 && (
        // First, and separated: it is what the block LOOKS like, not what
        // it says, and the fields below are all the latter.
        <label className="flex flex-col gap-1.5 border-b pb-3">
          <span className="text-xs font-medium text-muted-foreground">
            {t('canvas.variant.fieldLabel')}
          </span>
          <select
            className={nativeFieldClass}
            value={block.variant ?? ''}
            onChange={(event) =>
              onChangeVariant(event.target.value || undefined)
            }
          >
            {/* The type's own look has no variant of its own, so the
                empty value means "none" rather than naming one. */}
            <option value="">{t('canvas.variant.default')}</option>
            {variants.map((variant) => (
              <option key={variant.value} value={variant.value}>
                {tLabel(variant.label)}
              </option>
            ))}
          </select>
        </label>
      )}
      {onChangeAlign && (
        // Beside the look, and above the content fields, for the same
        // reason: this is what the block IS on the page, not what it says.
        <label className="flex flex-col gap-1.5 border-b pb-3">
          <span className="text-xs font-medium text-muted-foreground">
            {t('canvas.align.fieldLabel')}
          </span>
          <select
            className={nativeFieldClass}
            value={block.align ?? 'content'}
            onChange={(event) => {
              const value = event.target.value as BlockAlign;
              // `content` is the default and is stored as its absence, so
              // the block does not carry a field saying "behave normally".
              onChangeAlign(value === 'content' ? undefined : value);
            }}
          >
            {ALIGN_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`canvas.align.${option}`)}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {t('canvas.align.hint')}
          </span>
        </label>
      )}
      {descriptor.fields.map((field) => {
        const showRequiredWarning = isRequiredFieldEmpty(field, block.props);
        return (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {tLabel(field.label)}
              {(field.kind === 'text' ||
                field.kind === 'textarea' ||
                field.kind === 'richtext') &&
                field.required && <span className="text-destructive"> *</span>}
            </span>
            <FieldRow
              field={field}
              value={block.props[field.key]}
              onChange={(value) => onChangeProp(field.key, value)}
            />
            {showRequiredWarning && (
              <span className="text-xs text-amber-600 dark:text-amber-500">
                {t('canvas.requiredField')}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
