import { editorAppUrl } from './editor-app-url';

// Stesso motivo di renderBlockFragmentCorsHeaders (render-block-fragment-
// helpers.ts): editor-app (apps/editor-app) gira su un'origine diversa in
// dev e deve poter leggere queste risposte GET. Nessun token qui — sia il
// manifest icone (docs/adr/0023) sia i default di stile per blocco
// (docs/adr/0022) sono pubblici allo stesso titolo del resto di
// public-pages, niente dato utente coinvolto. Condiviso da ogni endpoint
// sotto `/api/themes/current/*`, non un file per endpoint: stesse regole,
// stesso motivo, non c'è nulla di specifico da duplicare.
export function themesApiCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': editorAppUrl(),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}
