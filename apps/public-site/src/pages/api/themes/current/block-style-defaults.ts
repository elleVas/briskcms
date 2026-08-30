import type { APIRoute } from 'astro';
import { listBlockStyleDefaults } from '../../../../lib/resolve-theme-block-style-defaults';
import { themesApiCorsHeaders } from '../../../../lib/themes-api-cors';

// docs/adr/0022's follow-up: il valore RISOLTO (non il token grezzo) di
// ogni proprietà stilizzabile per tipo di blocco, contro il tema attivo —
// permette all'editor di precompilare il popover di stile con l'aspetto
// reale attuale invece di lasciarlo vuoto. Stesso motivo/pattern di
// icons.ts: risolto qui perché solo apps/public-site conosce il tema
// attivo davvero (~theme).
export const prerender = false;

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: themesApiCorsHeaders() });

export const GET: APIRoute = () =>
  new Response(JSON.stringify(listBlockStyleDefaults()), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...themesApiCorsHeaders(),
    },
  });
