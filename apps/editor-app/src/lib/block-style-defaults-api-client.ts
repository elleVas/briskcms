import {
  blockStyleDefaultsResponseSchema,
  type BlockStyleDefaultsResponse,
} from '@brisk/shared-types';
import { PUBLIC_SITE_URL } from './public-site-url.js';

/**
 * Chiama apps/public-site direttamente (mai apps/api) — stesso motivo di
 * fetchThemeIcons (theme-icons-api-client.ts): è l'unica app che conosce
 * il tema attivo (`~theme`, docs/adr/0021).
 */
export async function fetchBlockStyleDefaults(): Promise<BlockStyleDefaultsResponse> {
  const res = await fetch(
    `${PUBLIC_SITE_URL}/api/themes/current/block-style-defaults`,
  );
  if (!res.ok) {
    throw new Error(
      `themes/current/block-style-defaults API error: ${res.status}`,
    );
  }
  return blockStyleDefaultsResponseSchema.parse(await res.json());
}
