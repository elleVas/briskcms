import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  CONSENT_CATEGORIES,
  type ConsentCategory,
  type TrackerScriptEntry,
  type TrackerScriptPlacement,
} from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { IconButton } from './icon-button';

export interface TrackerScriptListEditorProps {
  entries: TrackerScriptEntry[];
  onChange: (entries: TrackerScriptEntry[]) => void;
}

// Same cap as TrackerDomainListEditor (site-theme-settings.ts) — mirrored
// here from cookie-consent.ts's MAX_TRACKER_SCRIPTS.
const MAX_ENTRIES = 20;

/**
 * Cookie consent (docs/adr/0039): each entry here is one third-party
 * snippet, tagged with the consent category that gates it at render time
 * (apps/public-site/src/lib/consent-script-blocking.ts) — the structured
 * alternative to the free-text head/body script fields above, which have
 * no per-snippet boundary and can't be gated at all. Entries are usually
 * added automatically (a known vendor pasted above gets detected and moved
 * here on save, see update-site-theme-settings.use-case.ts's
 * tracker-signature-detector), but can also be added or recategorized by
 * hand for a vendor the detector doesn't recognize.
 */
export function TrackerScriptListEditor({
  entries,
  onChange,
}: TrackerScriptListEditorProps) {
  const { t } = useTranslation();
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] =
    useState<ConsentCategory>('measurement');
  const [newPlacement, setNewPlacement] =
    useState<TrackerScriptPlacement>('head');
  const [newHtml, setNewHtml] = useState('');

  function addEntry() {
    const label = newLabel.trim();
    const html = newHtml.trim();
    if (!label || !html) return;

    onChange([
      ...entries,
      {
        id: crypto.randomUUID(),
        label,
        category: newCategory,
        placement: newPlacement,
        html,
      },
    ]);
    setNewLabel('');
    setNewHtml('');
  }

  function removeEntry(id: string) {
    onChange(entries.filter((entry) => entry.id !== id));
  }

  function updateCategory(id: string, category: ConsentCategory) {
    onChange(
      entries.map((entry) =>
        entry.id === id ? { ...entry, category } : entry,
      ),
    );
  }

  const atCap = entries.length >= MAX_ENTRIES;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{entry.label}</span>
              <span className="text-xs text-muted-foreground">
                {t(`integrations.placement.${entry.placement}`)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={entry.category}
                onValueChange={(value) =>
                  updateCategory(entry.id, value as ConsentCategory)
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONSENT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {t(`cookieConsent.category.${category}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <IconButton
                label={t('integrations.removeTrackerScript')}
                onClick={() => removeEntry(entry.id)}
              >
                <Trash2 />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder={t('integrations.trackerScriptLabelPlaceholder')}
            className="flex-1"
            disabled={atCap}
          />
          <Select
            value={newCategory}
            onValueChange={(value) => setNewCategory(value as ConsentCategory)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONSENT_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {t(`cookieConsent.category.${category}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={newPlacement}
            onValueChange={(value) =>
              setNewPlacement(value as TrackerScriptPlacement)
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="head">
                {t('integrations.placement.head')}
              </SelectItem>
              <SelectItem value="body">
                {t('integrations.placement.body')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={newHtml}
          onChange={(event) => setNewHtml(event.target.value)}
          placeholder={t('integrations.trackerScriptHtmlPlaceholder')}
          rows={2}
          className="font-mono text-xs"
          disabled={atCap}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={addEntry}
          disabled={atCap || !newLabel.trim() || !newHtml.trim()}
        >
          <Plus className="size-3.5" />
          {t('integrations.addTrackerScript')}
        </Button>
      </div>
    </div>
  );
}
