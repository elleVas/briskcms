import type { APIRoute } from 'astro';
import { listThemeIcons } from '../../../../lib/resolve-theme-icons';
import { themesApiCorsHeaders } from '../../../../lib/themes-api-cors';

// docs/adr/0042 — see base-tokens.ts's own comment on the ?theme= param.
export const prerender = false;

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: themesApiCorsHeaders() });

// `?set=brand` asks for the logos, anything else for the interface icons
// (ADR-0053). They are separate requests because the brands serialise to
// 5.2MB against the interface set's 1.1MB, and an editor that never opens
// the brand tab should not pay for them.
export const GET: APIRoute = ({ url }) =>
  new Response(
    JSON.stringify(
      listThemeIcons(
        url.searchParams.get('theme') ?? '',
        url.searchParams.get('set') === 'brand' ? 'brand' : 'interface',
      ),
    ),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...themesApiCorsHeaders(),
      },
    },
  );
