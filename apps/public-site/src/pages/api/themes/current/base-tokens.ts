import type { APIRoute } from 'astro';
import { resolveThemeBaseTokens } from '../../../../lib/resolve-theme-base-tokens.js';
import { themesApiCorsHeaders } from '../../../../lib/themes-api-cors.js';

// Stesso pattern/motivo di foreground-tokens.ts: solo apps/public-site
// conosce il tema attivo (~theme) — l'editor lo consuma per mostrare i
// valori di partenza reali del tema in GlobalStylesDialog.
export const prerender = false;

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: themesApiCorsHeaders() });

export const GET: APIRoute = () =>
  new Response(JSON.stringify(resolveThemeBaseTokens()), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...themesApiCorsHeaders(),
    },
  });
