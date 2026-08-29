// RTL scripts in actual use across Brisk's realistic locale range — matched
// on the locale's base language subtag (`ar`/`ar-SA`/`ar-EG` all count),
// since `locale-list-editor.tsx` accepts any 2+ char string with no ISO
// validation (an agency's own naming convention is theirs to pick). Not
// exhaustive of every RTL script that exists, just the ones a real client
// site is plausible to need; add to this list if one comes up.
const RTL_LANGUAGE_SUBTAGS = new Set([
  'ar', // Arabic
  'he', // Hebrew
  'fa', // Persian/Farsi
  'ur', // Urdu
]);

export function isRtlLocale(locale: string): boolean {
  const subtag = locale.split('-')[0]?.toLowerCase();
  return subtag !== undefined && RTL_LANGUAGE_SUBTAGS.has(subtag);
}

export function localeDirection(locale: string): 'ltr' | 'rtl' {
  return isRtlLocale(locale) ? 'rtl' : 'ltr';
}
