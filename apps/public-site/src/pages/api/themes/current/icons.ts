import type { APIRoute } from 'astro';
import { listThemeIcons } from '../../../../lib/resolve-theme-icons';
import { themesApiCorsHeaders } from '../../../../lib/themes-api-cors';

// docs/adr/0023: resolved server-side here (apps/public-site is the only
// app with a real ~theme alias, editor-app/apps/api have no concept of
// which theme is active) — chiamato da editor-app una volta per sessione
// per popolare il picker icone.
export const prerender = false;

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: themesApiCorsHeaders() });

export const GET: APIRoute = () =>
  new Response(JSON.stringify(listThemeIcons()), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...themesApiCorsHeaders(),
    },
  });
