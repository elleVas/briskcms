export interface FeatureListFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
}

// Puck has no native list-of-strings field — same problem
// table-data-field.tsx solved for a 2D matrix, solved here the simplest way
// that fits a flat list: one plain <textarea>, one feature per line, split
// on "\n" going in and joined back going out. No add/remove-row buttons
// needed (unlike table-data-field.tsx) since a textarea already lets an
// editor add/remove lines directly.
export function FeatureListField({ value, onChange }: FeatureListFieldProps) {
  return (
    <textarea
      value={value.join('\n')}
      onChange={(event) => onChange(event.target.value.split('\n'))}
      rows={5}
      placeholder={'Una caratteristica per riga...'}
      style={{
        width: '100%',
        padding: '6px 8px',
        borderRadius: 4,
        border: '1px solid var(--puck-color-border, #d4d4d8)',
        background: 'var(--puck-color-surface, #fff)',
        color: 'var(--puck-color-text, #18181b)',
        font: 'inherit',
        fontSize: 14,
        resize: 'vertical',
      }}
    />
  );
}
