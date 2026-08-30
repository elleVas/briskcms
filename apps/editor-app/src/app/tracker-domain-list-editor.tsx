import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  trackerDomainSchema,
  type TrackerDomainEntry,
} from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { IconButton } from './icon-button';

export interface TrackerDomainListEditorProps {
  entries: TrackerDomainEntry[];
  onChange: (entries: TrackerDomainEntry[]) => void;
}

// ADR-0031's CSP tracker whitelist — a bare hostname per entry (no scheme,
// no path, matches trackerDomainSchema), applied automatically to
// script-src/connect-src/frame-src for this site (see
// content-security-policy.ts) rather than asking the admin to pick
// directives one by one: whoever can reach this page already has
// unrestricted script execution via the head/body script fields above, so
// per-directive granularity wouldn't lower risk, just add form complexity.
export function TrackerDomainListEditor({
  entries,
  onChange,
}: TrackerDomainListEditorProps) {
  const { t } = useTranslation();
  const [newLabel, setNewLabel] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState('');

  function addEntry() {
    const label = newLabel.trim();
    const domain = newDomain.trim().toLowerCase();
    if (!label || !domain) return;

    const result = trackerDomainSchema.safeParse(domain);
    if (!result.success) {
      setError(t('integrations.invalidDomain'));
      return;
    }

    setError('');
    onChange([...entries, { label, domain: result.data }]);
    setNewLabel('');
    setNewDomain('');
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }

  const atCap = entries.length >= 20;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry, index) => (
          <li
            // Only ever appended/removed here, never reordered — same
            // reasoning as opening-hours-editor.tsx's own index keys.
            key={index}
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{entry.label}</span>
              <span className="text-xs text-muted-foreground">
                {entry.domain}
              </span>
            </div>
            <IconButton
              label={t('integrations.removeDomain')}
              onClick={() => removeEntry(index)}
            >
              <Trash2 />
            </IconButton>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder={t('integrations.domainLabelPlaceholder')}
          className="w-32"
          disabled={atCap}
        />
        <Input
          value={newDomain}
          onChange={(event) => {
            setNewDomain(event.target.value);
            setError('');
          }}
          placeholder={t('integrations.domainPlaceholder')}
          className="flex-1"
          disabled={atCap}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addEntry}
          disabled={atCap || !newLabel.trim() || !newDomain.trim()}
        >
          <Plus className="size-3.5" />
          {t('integrations.addDomain')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
