import { PUBLIC_SITE_URL } from './public-site-url.js';

export interface RenderBlockFragmentInput {
  pageId: string;
  token: string;
  blockId: string;
  blockType: string;
  props: Record<string, unknown>;
}

/**
 * Chiama apps/public-site direttamente (mai attraverso apps/api): è
 * l'unica app capace di renderizzare un componente .astro — vedi il piano
 * dell'editor visuale, Giorno 3. Cross-origin in dev (porta 4321 vs 4200 di
 * editor-app), per questo quella rotta ha il proprio CORS scoped a questa
 * origine (vedi render-block-fragment.ts). Non passa da http-client.ts:
 * quella base URL punta ad apps/api, non ad apps/public-site.
 */
export async function renderBlockFragment(
  input: RenderBlockFragmentInput,
): Promise<string> {
  const res = await fetch(`${PUBLIC_SITE_URL}/api/render-block-fragment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`render-block-fragment API error: ${res.status}`);
  }
  const body: { html: string } = await res.json();
  return body.html;
}
