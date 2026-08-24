import { iconManifestSchema, type IconEntry } from '@brisk/shared-types';
import { PUBLIC_SITE_URL } from './public-site-url.js';

/**
 * Chiama apps/public-site direttamente (mai apps/api) — stesso motivo di
 * renderBlockFragment (block-fragment-api-client.ts): è l'unica app che
 * conosce il tema attivo (`~theme`, docs/adr/0021), non passa quindi da
 * http-client.ts, la cui base URL punta ad apps/api.
 */
export async function fetchThemeIcons(): Promise<IconEntry[]> {
  const res = await fetch(`${PUBLIC_SITE_URL}/api/themes/current/icons`);
  if (!res.ok) {
    throw new Error(`themes/current/icons API error: ${res.status}`);
  }
  return iconManifestSchema.parse(await res.json());
}
