import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor, FieldDescriptor } from '@brisk/block-registry';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { useTranslation } from '../../lib/use-translation';

export interface InspectorPanelProps {
  block: Block;
  descriptor: BlockDescriptor;
  onChangeProp: (key: string, value: unknown) => void;
}

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
      const Custom = field.component;
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
  if (field.kind !== 'text' && field.kind !== 'textarea') return false;
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
}: InspectorPanelProps) {
  const { t, tLabel } = useTranslation();
  if (descriptor.fields.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{tLabel(descriptor.label)}</h3>
      {descriptor.fields.map((field) => {
        const showRequiredWarning = isRequiredFieldEmpty(field, block.props);
        return (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {tLabel(field.label)}
              {(field.kind === 'text' || field.kind === 'textarea') &&
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
