import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { IconEntry } from '@brisk/shared-types';

// Stesso pattern di resolve-theme-block-override.ts/resolve-theme-layout-
// override.ts (docs/adr/0021): `~theme/icons/*.svg` risolto a build time
// via il glob Vite, non un caricamento a runtime — un tema che non
// dichiara `icons` in theme.json semplicemente non ha file lì, il glob
// combacia con niente, nessun errore.
const themeIcons = import.meta.glob<string>('~theme/icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

// Il set curato di default (docs/adr/0023): l'intero set Lucide corrente,
// stessa famiglia già usata da editor-app via lucide-react (vedi
// apps/editor-app/package.json) — non un sottoinsieme vendorizzato a mano,
// così resta allineato a ogni bump di versione senza un passo di
// download/sync separato. `lucide-static` è l'unico pacchetto della
// famiglia Lucide che pubblica SVG grezzi anziché componenti React/Vue —
// l'unica forma utilizzabile qui (apps/public-site non ha un runtime React
// lato server per i blocchi core, docs/adr/0019). Risolto via Node
// (`import.meta.resolve`), non `import.meta.glob`: un pattern che punta
// dentro node_modules non è un percorso relativo né l'alias `~theme` che
// il glob di Vite gestisce in questo progetto, mentre la risoluzione dei
// moduli Node trova il pacchetto ovunque pnpm l'abbia effettivamente
// symlinkato, indipendentemente dalla struttura di hoisting.
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

function iconNameFromThemePath(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1].replace(/\.svg$/, '');
}

/**
 * Tutto il set di icone del tema attivo — un tema che ne dichiara almeno
 * una VINCE per intero sul default (nessun fallback per-nome su un set
 * parziale, vedi la sezione Consequences di docs/adr/0023): la scelta
 * "questo tema ha o non ha il proprio set" è binaria, non un merge.
 */
export function listThemeIcons(): IconEntry[] {
  const themeEntries = Object.entries(themeIcons);
  if (themeEntries.length === 0) return getDefaultIcons();
  return themeEntries
    .map(([path, svg]) => ({ name: iconNameFromThemePath(path), svg }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

let iconsByName: Map<string, string> | null = null;

/** Risoluzione per-nome usata dal rendering dei blocchi (es. NavLink.astro) — costruisce la mappa una sola volta per processo. */
export function resolveIconSvg(name: string | null | undefined): string | null {
  if (!name) return null;
  if (!iconsByName) {
    iconsByName = new Map(
      listThemeIcons().map((icon) => [icon.name, icon.svg]),
    );
  }
  return iconsByName.get(name) ?? null;
}
