export interface FeatureListFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
}

/** A pricing plan has no native field for a list of strings — a single `<textarea>`, one feature per line, split/join on "\n". */
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
        border: '1px solid #d4d4d8',
        background: '#fff',
        color: '#18181b',
        font: 'inherit',
        fontSize: 14,
        resize: 'vertical',
      }}
    />
  );
}
