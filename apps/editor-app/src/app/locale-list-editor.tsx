import { useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  CURATED_LOCALE_CODES,
  getLocaleDisplayName,
} from '@brisk/shared-types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { IconButton } from './icon-button';

export interface LocaleListEditorProps {
  enabledLocales: string[];
  defaultLocale: string;
  onChange: (enabledLocales: string[], defaultLocale: string) => void;
}

/**
 * A site's `enabledLocales`/`defaultLocale` (docs/adr/0017): picked from
 * CURATED_LOCALE_CODES, a curated BCP-47 list — not exhaustive, and not
 * enforced by localeSettingsSchema itself (still accepts any 2+ character
 * string, see that schema's own comment), so a site with an existing
 * non-curated code keeps working unchanged; it just won't show up
 * pre-selected in this picker. Same "input + client-side filter" pattern
 * as IconPickerDialog (docs/adr/0023), not a full Combobox/cmdk dependency
 * — this project has deliberately avoided that so far.
 */
export function LocaleListEditor({
  enabledLocales,
  defaultLocale,
  onChange,
}: LocaleListEditorProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const availableCodes = useMemo(
    () =>
      CURATED_LOCALE_CODES.filter(
        (code) => !enabledLocales.includes(code.toLowerCase()),
      ),
    [enabledLocales],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableCodes;
    return availableCodes.filter(
      (code) =>
        code.toLowerCase().includes(q) ||
        getLocaleDisplayName(code, i18n.language).toLowerCase().includes(q),
    );
  }, [availableCodes, search, i18n.language]);

  function addLocale(code: string) {
    onChange([...enabledLocales, code.toLowerCase()], defaultLocale);
    setSearch('');
    setOpen(false);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && filtered.length > 0) {
      event.preventDefault();
      addLocale(filtered[0]);
    }
  }

  function removeLocale(code: string) {
    const remaining = enabledLocales.filter((locale) => locale !== code);
    onChange(
      remaining,
      code === defaultLocale ? (remaining[0] ?? defaultLocale) : defaultLocale,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {enabledLocales.map((code) => (
          <li
            key={code}
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium uppercase">{code}</span>
              <span className="text-xs text-muted-foreground">
                {getLocaleDisplayName(code, i18n.language)}
              </span>
              {code === defaultLocale ? (
                <Badge variant="secondary">
                  {t('localeSettings.defaultBadge')}
                </Badge>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(enabledLocales, code)}
                >
                  {t('localeSettings.setDefault')}
                </Button>
              )}
            </div>
            <IconButton
              label={t('localeSettings.removeLocale')}
              onClick={() => removeLocale(code)}
              disabled={enabledLocales.length <= 1}
            >
              <Trash2 />
            </IconButton>
          </li>
        ))}
      </ul>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
          >
            <Plus className="size-3.5" />
            {t('localeSettings.addLocale')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-2">
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('localeSettings.newLocalePlaceholder')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {filtered.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-muted-foreground">
              {t('localeSettings.noMatches')}
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {filtered.map((code) => (
                <li key={code}>
                  <button
                    type="button"
                    onClick={() => addLocale(code)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span>{getLocaleDisplayName(code, i18n.language)}</span>
                    <span className="text-xs text-muted-foreground uppercase">
                      {code}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
