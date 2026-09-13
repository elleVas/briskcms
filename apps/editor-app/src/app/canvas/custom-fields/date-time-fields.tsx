import { Input } from '../../../components/ui/input';

export interface DateTimeFieldProps {
  value: unknown;
  onChange: (value: string) => void;
}

/**
 * A date, stored as `YYYY-MM-DD` — the one spelling that sorts as text,
 * compares as text and means the same day in every language. The
 * browser's own date input writes exactly that whatever the editor's
 * locale shows, which is why it is used rather than a picker of our own:
 * a date typed as "13/09/2026" means one day in Rome and none in Boston.
 *
 * Cleared, it is the empty string, which every block reading one takes as
 * "no date" — the same empty a text field leaves.
 */
export function DateField({ value, onChange }: DateTimeFieldProps) {
  return (
    <Input
      type="date"
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** A time of day, stored as `HH:MM` for the date's reason. Empty is "all day". */
export function TimeField({ value, onChange }: DateTimeFieldProps) {
  return (
    <Input
      type="time"
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
