import type { Block, BlockStyleOverride } from '@brisk/shared-types';
import { PUBLIC_SITE_URL } from './public-site-url';

export interface RenderBlockFragmentInput {
  pageId: string;
  token: string;
  blockId: string;
  blockType: string;
  props: Record<string, unknown>;
  /** I figli correnti del blocco (se contenitore), noti già lato client — evita che il server li ricostruisca leggendo la bozza salvata, che può non aver ancora recepito il salvataggio in corso in parallelo. */
  children?: Block[];
  /** Override per-istanza (docs/adr/0022) — senza questo, un cambio di stile dal canvas non si vedrebbe nel frammento appena patchato. */
  styleOverride?: BlockStyleOverride;
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
