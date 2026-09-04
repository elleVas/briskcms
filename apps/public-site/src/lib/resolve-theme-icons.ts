import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { IconEntry } from '@brisk/shared-types';
import { groupByTheme, resolveBundledThemeName } from './theme-registry';

// Stesso pattern di resolve-theme-block-override.ts/resolve-theme-layout-
// override.ts (docs/adr/0021/0042): `themes/<name>/icons/*.svg` risolto
// una volta per processo per ogni tema bundlato — un tema che non
// dichiara `icons` in theme.json semplicemente non ha un'entry nella
// propria mappa, nessun errore.
const themeIconModules = import.meta.glob<string>(
  '../../../../themes/*/icons/*.svg',
  {
    eager: true,
    query: '?raw',
    import: 'default',
  },
);

function iconNameFromPath(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '');
}

const themeIconsByTheme = groupByTheme(
  themeIconModules,
  iconNameFromPath,
  (svg) => svg,
);

// Il set curato di default (docs/adr/0023): l'intero set Lucide corrente,
// stessa famiglia già usata da editor-app via lucide-react (vedi
// apps/editor-app/package.json) — non un sottoinsieme vendorizzato a mano,
// così resta allineato a ogni bump di versione senza un passo di
// download/sync separato. `lucide-static` è l'unico pacchetto della
// famiglia Lucide che pubblica SVG grezzi anziché componenti React/Vue —
// l'unica forma utilizzabile qui (apps/public-site non ha un runtime React
// lato server per i blocchi core, docs/adr/0019). Risolto via Node
// (`import.meta.resolve`), non `import.meta.glob`: un pattern che punta
// dentro node_modules non è un percorso relativo che il glob di Vite
// gestisce in questo progetto, mentre la risoluzione dei moduli Node trova
// il pacchetto ovunque pnpm l'abbia effettivamente symlinkato,
// indipendentemente dalla struttura di hoisting.
function loadDefaultIcons(): IconEntry[] {
  const packageJsonUrl = import.meta.resolve('lucide-static/package.json');
  const iconsDir = join(dirname(fileURLToPath(packageJsonUrl)), 'icons');
  return readdirSync(iconsDir)
    .filter((file) => file.endsWith('.svg'))
    .sort()
    .map((file) => ({
      name: file.replace(/\.svg$/, ''),
      svg: readFileSync(join(iconsDir, file), 'utf-8'),
    }));
}

let defaultIcons: IconEntry[] | null = null;

function getDefaultIcons(): IconEntry[] {
  if (!defaultIcons) defaultIcons = loadDefaultIcons();
  return defaultIcons;
}

/**
 * Tutto il set di icone del tema attivo — un tema che ne dichiara almeno
 * una VINCE per intero sul default (nessun fallback per-nome su un set
 * parziale, vedi la sezione Consequences di docs/adr/0023): la scelta
 * "questo tema ha o non ha il proprio set" è binaria, non un merge.
 */
export function listThemeIcons(themeName: string): IconEntry[] {
  const themeIcons = themeIconsByTheme.get(resolveBundledThemeName(themeName));
  if (!themeIcons || themeIcons.size === 0) {
    return getDefaultIcons();
  }
  return [...themeIcons.entries()]
    .map(([name, svg]) => ({ name, svg }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const iconsByNamePerTheme = new Map<string, Map<string, string>>();

/** Risoluzione per-nome usata dal rendering dei blocchi (es. NavLink.astro) — costruisce la mappa una sola volta per tema. */
export function resolveIconSvg(
  name: string | null | undefined,
  themeName: string,
): string | null {
  if (!name) return null;
  const resolvedTheme = resolveBundledThemeName(themeName);
  let iconsByName = iconsByNamePerTheme.get(resolvedTheme);
  if (!iconsByName) {
    iconsByName = new Map(
      listThemeIcons(resolvedTheme).map((icon) => [icon.name, icon.svg]),
    );
    iconsByNamePerTheme.set(resolvedTheme, iconsByName);
  }
  return iconsByName.get(name) ?? null;
}
