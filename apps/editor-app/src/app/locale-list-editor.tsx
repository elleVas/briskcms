import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { IconButton } from './icon-button.js';

export interface LocaleListEditorProps {
  enabledLocales: string[];
  defaultLocale: string;
  onChange: (enabledLocales: string[], defaultLocale: string) => void;
}

// A site's `enabledLocales`/`defaultLocale` (docs/adr/0017): free-text
// locale codes rather than a fixed dropdown of languages — no ISO-639
// validation beyond "at least 2 characters" (matches localeSettingsSchema),
// since an agency's own convention for a locale code (e.g. 'en-US' vs
// 'en') is theirs to pick, not this editor's to constrain.
export function LocaleListEditor({
  enabledLocales,
  defaultLocale,
  onChange,
}: LocaleListEditorProps) {
  const { t } = useTranslation();
  const [newLocale, setNewLocale] = useState('');

  function addLocale() {
    const code = newLocale.trim().toLowerCase();
    if (code.length < 2 || enabledLocales.includes(code)) return;
    onChange([...enabledLocales, code], defaultLocale);
    setNewLocale('');
  }

  function handleNewLocaleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addLocale();
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
      <div className="flex items-center gap-2">
        <Input
          value={newLocale}
          onChange={(event) => setNewLocale(event.target.value)}
          onKeyDown={handleNewLocaleKeyDown}
          placeholder={t('localeSettings.newLocalePlaceholder')}
          className="w-28"
          maxLength={10}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLocale}
          disabled={newLocale.trim().length < 2}
        >
          <Plus className="size-3.5" />
          {t('localeSettings.addLocale')}
        </Button>
      </div>
    </div>
  );
}
