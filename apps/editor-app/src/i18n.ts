import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import it from './locales/it.json';

// Module augmentation off `it` (not `en`) is deliberate: it's the language
// this team writes copy in first, so its key set is the one TypeScript
// should catch typos/omissions against — see resources below.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof it;
    };
  }
}

// No browser-language auto-detection: an explicit `lng` keeps the starting
// language deterministic (tests, first-time users in the target IT market)
// — LanguageSwitcher (see app/language-switcher.tsx) is how it changes.
void i18next.use(initReactI18next).init({
  lng: 'it',
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  fallbackLng: 'it',
  interpolation: { escapeValue: false },
});

export default i18next;
