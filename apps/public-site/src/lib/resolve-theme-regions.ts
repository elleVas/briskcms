import { groupByTheme, resolveBundledThemeName } from './theme-registry';

/**
 * Le regioni che un tema può fornire — `themes/<nome>/regions/Header.astro`,
 * `ContentShell.astro`, `Footer.astro` — risolte una volta per processo per
 * ogni tema bundlato e cercate per `(tema, regione)` a ogni render.
 *
 * Sostituisce l'override completo di `PageLayout.astro`
 * (resolve-theme-layout-override.ts, rimosso a fine migrazione): quello
 * costringeva un tema a copiare 581 righe di shell per cambiarne una, e la
 * copia derivava in silenzio — link di accessibilità perso, attributi
 * dell'editor persi, CSS che colava sugli altri temi. Qui il tema non può
 * toccare nulla di tutto ciò: riceve i blocchi già renderizzati come slot.
 *
 * Un tema che non fornisce una regione ottiene quella del core, identica a
 * come è sempre stata: un glob che non combacia è una mappa vuota, non un
 * errore.
 */
const themeRegionModules = import.meta.glob<{ default: unknown }>(
  '../../../../themes/*/regions/*.astro',
  { eager: true },
);

export type ThemeRegionName = 'Header' | 'ContentShell' | 'Footer';

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.astro$/, '');
}

const regionsByTheme = groupByTheme(
  themeRegionModules,
  basename,
  (mod) => mod.default,
);

/**
 * Il componente del tema per questa regione, o `null` se il tema non ne
 * fornisce uno — nel qual caso il chiamante usa il proprio wrapper di
 * default. Il nome del tema passa da `resolveBundledThemeName`, così un
 * `Site.themeName` stantio ricade sul tema di riserva invece di cercare
 * regioni che non esistono.
 */
export function resolveThemeRegion<T>(
  region: ThemeRegionName,
  themeName: string,
): T | null {
  const override = regionsByTheme
    .get(resolveBundledThemeName(themeName))
    ?.get(region);
  return (override as T | undefined) ?? null;
}
