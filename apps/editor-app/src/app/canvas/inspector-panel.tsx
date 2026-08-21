import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor, FieldDescriptor } from '@brisk/block-registry';

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

/** Un input per kind — pannello guidato dal field descriptor, sostituisce Puck's Fields<T> sidebar (docs/adr/0007, vedi il piano dell'editor visuale, Giorno 3). */
function FieldRow({ field, value, onChange }: FieldRowProps) {
  switch (field.kind) {
    case 'text':
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'textarea':
      return (
        <textarea
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'number':
      return (
        <input
          type="number"
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
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
      );
    case 'radio':
    case 'select':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
 * Sostituisce il pannello Fields<T> di Puck (docs/adr/0007) — un input per
 * campo, guidato dal `BlockDescriptor` del blocco selezionato. `inlineEditable`
 * qui non ha ancora effetto (il montaggio TipTap sul canvas è Giorno 4): per
 * ora ogni campo, testuale o no, è modificabile solo da qui, come fallback
 * reale già garantito dal piano.
 */
export function InspectorPanel({
  block,
  descriptor,
  onChangeProp,
}: InspectorPanelProps) {
  if (descriptor.fields.length === 0) {
    return null;
  }

  return (
    <div>
      <h3>{descriptor.label}</h3>
      {descriptor.fields.map((field) => (
        <label key={field.key}>
          <span>{field.label}</span>
          <FieldRow
            field={field}
            value={block.props[field.key]}
            onChange={(value) => onChangeProp(field.key, value)}
          />
        </label>
      ))}
    </div>
  );
}
