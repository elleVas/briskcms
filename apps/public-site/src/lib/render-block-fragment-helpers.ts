import { editorAppUrl } from './editor-app-url.js';

export interface RenderBlockFragmentBody {
  pageId: string;
  token: string;
  blockId: string;
  blockType: string;
  props: Record<string, unknown>;
}

/**
 * Isolata dalla rotta stessa (render-block-fragment.ts) perché quel file
 * importa un componente .astro — vitest, con la config plain di questo
 * progetto (nessun plugin Vite di Astro registrato), non riesce a fare il
 * transform di un import .astro nel grafo dei moduli di un file di test.
 * La verifica end-to-end di quella rotta (token/CSS scoping/CORS) è stata
 * fatta dal vivo contro il dev server reale, non qui — vedi il piano
 * dell'editor visuale, Giorno 3.
 */
export function isValidRenderBlockFragmentBody(
  body: unknown,
): body is RenderBlockFragmentBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate['pageId'] === 'string' &&
    typeof candidate['token'] === 'string' &&
    typeof candidate['blockId'] === 'string' &&
    typeof candidate['blockType'] === 'string' &&
    typeof candidate['props'] === 'object' &&
    candidate['props'] !== null
  );
}

export function renderBlockFragmentCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': editorAppUrl(),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
