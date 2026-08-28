import type { APIRoute } from 'astro';
import { resolveThemeForegroundTokens } from '../../../../lib/resolve-theme-foreground-tokens.js';
import { themesApiCorsHeaders } from '../../../../lib/themes-api-cors.js';

// Stesso pattern/motivo di block-style-defaults.ts: solo apps/public-site
// conosce il tema attivo (~theme) — l'editor lo consuma per il controllo
// di contrasto WCAG sul color picker primario/secondario del tema
// (GlobalStylesDialog).
export const prerender = false;

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: themesApiCorsHeaders() });

export const GET: APIRoute = () =>
  new Response(JSON.stringify(resolveThemeForegroundTokens()), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...themesApiCorsHeaders(),
    },
  });
