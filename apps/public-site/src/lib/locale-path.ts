// The "home" slug is the well-known convention (predates multilingua) for
// "the page that answers a locale's own root" — `/it/` rather than a
// literal `/it/home`. Every other slug gets a plain `/{locale}/{slug}`.
// Shared by src/pages/[locale]/[slug].astro's sibling routes, sitemap.xml.ts,
// and (once built) the public-facing language switcher (docs/adr/0017) —
// one place computing "the real reachable URL for this locale/slug pair".
export function localePath(locale: string, slug: string): string {
  return slug === 'home' ? `/${locale}/` : `/${locale}/${slug}`;
}
