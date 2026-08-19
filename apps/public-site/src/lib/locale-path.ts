// The "home" slug is the well-known convention (predates multilingua) for
// "the page that answers a locale's own root" — `/it/` rather than a
// literal `/it/home`. Every other slug gets a plain `/{locale}/{slug}`.
// Shared by src/pages/[locale]/[slug].astro's sibling routes, sitemap.xml.ts,
// and (once built) the public-facing language switcher (docs/adr/0017) —
// one place computing "the real reachable URL for this locale/slug pair".
export function localePath(locale: string, slug: string): string {
  return slug === 'home' ? `/${locale}/` : `/${locale}/${slug}`;
}

// Deliberately a separate function rather than a new parameter on
// localePath(): only the catch-all route's canonical-redirect check and
// sitemap.xml.ts need a nested path today — NavLink, LanguageSwitcher and
// PageLayout's hreflang alternates still resolve a page by its own flat
// slug alone (see docs/adr for page hierarchy) and don't have an ancestor
// chain in hand, so their call sites are left untouched.
export function localePathFromAncestors(
  locale: string,
  ancestorSlugs: string[],
  slug: string,
): string {
  if (ancestorSlugs.length === 0) {
    return localePath(locale, slug);
  }
  return `/${locale}/${[...ancestorSlugs, slug].join('/')}`;
}
