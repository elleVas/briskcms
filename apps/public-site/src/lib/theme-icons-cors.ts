import { editorAppUrl } from './editor-app-url.js';

// Stesso motivo di renderBlockFragmentCorsHeaders (render-block-fragment-
// helpers.ts): il picker icone di editor-app (apps/editor-app) gira su
// un'origine diversa in dev e deve poter leggere questa risposta GET.
// Nessun token qui — il manifest icone del tema attivo è pubblico allo
// stesso titolo del resto di public-pages, niente dato utente coinvolto.
export function themeIconsCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': editorAppUrl(),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}
