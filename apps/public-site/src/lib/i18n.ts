import it from '../locales/it.json';
import en from '../locales/en.json';

const dictionaries = { it, en } as const;
const DEFAULT_LOCALE = 'it';

export type TranslationKey = keyof typeof it;

// UI-chrome strings for the ~12 "service" blocks (Countdown, Form,
// SearchBox, ...) that render regardless of a page's own content —
// unrelated to Block content translation (docs/adr/0017), which is
// per-page data, not per-locale UI copy. `locale` can be any string a site
// enables (LocaleSettings has no fixed list): falls back to the base
// language subtag ('en-US' -> 'en'), then to DEFAULT_LOCALE, never throws
// on a locale/key this dictionary has nothing for.
export function t(
  locale: string,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const lang = locale.split('-')[0] as keyof typeof dictionaries;
  const dict = dictionaries[lang] ?? dictionaries[DEFAULT_LOCALE];
  let value: string = dict[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replace(`{${name}}`, String(replacement));
    }
  }
  return value;
}
