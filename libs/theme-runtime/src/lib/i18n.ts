import it from './locales/it.json';
import en from './locales/en.json';

const dictionaries = { it, en } as const;
const DEFAULT_LOCALE = 'it';

export type TranslationKey = keyof typeof it;

// UI-chrome strings for the ~18 "service" blocks (Countdown, Form,
// SearchBox, ...) that render regardless of a page's own content —
// unrelated to Block content translation (docs/adr/0017), which is
// per-page data, not per-locale UI copy. One instance per rendering
// component (`new Translator(locale)`), not a bare exported function —
// resolves the dictionary once at construction instead of on every call,
// same collaborator-over-free-function shape as the rest of this codebase
// (docs/adr — see the ADR touching this file for the full reasoning).
export class Translator {
  private readonly dict: Record<string, string>;

  // `locale` can be any string a site enables (LocaleSettings has no fixed
  // list): falls back to the base language subtag ('en-US' -> 'en'), then
  // to DEFAULT_LOCALE, never throws on a locale this dictionary has
  // nothing for.
  constructor(locale: string) {
    const lang = locale.split('-')[0] as keyof typeof dictionaries;
    this.dict = dictionaries[lang] ?? dictionaries[DEFAULT_LOCALE];
  }

  t(key: TranslationKey, vars?: Record<string, string | number>): string {
    let value: string =
      this.dict[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
    if (vars) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.replace(`{${name}}`, String(replacement));
      }
    }
    return value;
  }
}
