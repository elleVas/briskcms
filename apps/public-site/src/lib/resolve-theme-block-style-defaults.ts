import themeCssRaw from '~theme/theme.css?raw';
import {
  BLOCK_STYLE_DEFAULTS,
  type BlockStyleDefaultsResponse,
} from '@brisk/shared-types';
import {
  parseRootCustomProperties,
  resolveBlockStyleDefaults,
} from './resolve-theme-block-style-defaults-helpers';

let cached: BlockStyleDefaultsResponse | null = null;

/**
 * Un'entry per ogni tipo di blocco dichiarato in
 * `BLOCK_STYLE_DEFAULTS` (shared-types — docs/adr/0022). Non legge
 * `@brisk/block-registry` direttamente: quel pacchetto è orientato ai
 * componenti React dell'editor (picker, dialog, contesti), e farlo
 * dipendere da apps/public-site ha causato un conflitto reale di
 * risoluzione TypeScript tra la configurazione di Astro e i file di test
 * React del registro — vedi la history di questo file. `BLOCK_STYLE_
 * DEFAULTS` in shared-types è la stessa identica sorgente di verità
 * (BlockDescriptor.defaultStyle la legge da lì anche lui), senza quel
 * problema. Calcolata una sola volta per processo: il tema attivo
 * (`~theme`) non cambia mai a runtime (docs/adr/0021).
 */
export function listBlockStyleDefaults(): BlockStyleDefaultsResponse {
  if (cached) return cached;
  const themeVars = parseRootCustomProperties(themeCssRaw);
  const result: BlockStyleDefaultsResponse = {};
  for (const [type, declared] of Object.entries(BLOCK_STYLE_DEFAULTS)) {
    result[type] = resolveBlockStyleDefaults(declared, themeVars);
  }
  cached = result;
  return result;
}
