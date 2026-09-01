import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import {
  collectResolvedPageRefs,
  resolvePageReferences,
  type Block,
} from '@brisk/shared-types';
import { getPreviewPageById } from '../../lib/public-api-client';
import { findBlockById } from '../../lib/find-block-by-id';
import {
  isValidRenderBlockFragmentBody,
  renderBlockFragmentCorsHeaders,
} from '../../lib/render-block-fragment-helpers';
import RenderSingleBlock from '../../components/RenderSingleBlock.astro';

// Chiamato da apps/editor-app (canvas-frame.tsx/block-fragment-api-client.ts),
// mai da un visitatore reale: l'editor-app gira su un'origine diversa
// (porta 4200 in dev), quindi serve CORS esplicito qui, scoped alla sola
// EDITOR_APP_URL — l'autenticazione vera resta il token di preview validato
// sotto (stesso token della rotta di preview, vedi il piano dell'editor
// visuale, Giorno 1/3), CORS decide solo "quale JS può leggere la
// risposta", non "chi è autorizzato".
export const prerender = false;

export const OPTIONS: APIRoute = () =>
  new Response(null, {
    status: 204,
    headers: renderBlockFragmentCorsHeaders(),
  });

export const POST: APIRoute = async ({ request }) => {
  const body: unknown = await request.json().catch(() => null);
  if (!isValidRenderBlockFragmentBody(body)) {
    return new Response('Bad request', {
      status: 400,
      headers: renderBlockFragmentCorsHeaders(),
    });
  }

  // Stesso collasso "indistinguibile dal non-esistente" della rotta di
  // preview: un token mancante/scaduto/mismatch e una pagina che non
  // esiste ricevono lo stesso 404.
  const page = await getPreviewPageById(body.pageId, body.token);
  if (!page) {
    return new Response('Not found', {
      status: 404,
      headers: renderBlockFragmentCorsHeaders(),
    });
  }

  // I `children` vanno preservati se il blocco è un contenitore — un
  // cambio di proprietà dall'Inspector non li tocca mai. Preferisce quelli
  // passati dal chiamante (già noti client-side, niente race col
  // salvataggio bozza in corso in parallelo — vedi RenderBlockFragmentBody);
  // la lettura server resta solo un fallback per chiamate più vecchie che
  // non li passano ancora.
  const children =
    body.children ??
    findBlockById(page.content, body.blockId)?.children ??
    findBlockById(page.header ?? [], body.blockId)?.children ??
    findBlockById(page.footer ?? [], body.blockId)?.children;

  const rawBlock: Block = {
    id: body.blockId,
    type: body.blockType,
    props: body.props,
    ...(children ? { children } : {}),
    ...(body.styleOverride ? { styleOverride: body.styleOverride } : {}),
  };

  // i18n a livello di campo (see the plan) — `body.props.page` (Link/
  // NavLink/etc.'s picked destination) arrives here as the editor's raw,
  // UNRESOLVED `{pageGroupId, title}` (see the plan's PagePickerField
  // fix): reuse whatever this exact group already resolved to elsewhere on
  // the SAME page (content/header/footer, already fetched above) rather
  // than a second round-trip just for this one block's own preview. A
  // brand-new reference not seen anywhere else on the page yet resolves to
  // `null` (a dead link, same as a field that was never picked at all)
  // until the next full reload — narrow, accepted gap, not a broken href.
  const resolvedRefs = new Map([
    ...collectResolvedPageRefs(page.content),
    ...collectResolvedPageRefs(page.header ?? []),
    ...collectResolvedPageRefs(page.footer ?? []),
  ]);
  const [block] = resolvePageReferences([rawBlock], resolvedRefs);

  const container = await AstroContainer.create();
  const html = await container.renderToString(RenderSingleBlock, {
    props: {
      block,
      locale: page.locale,
      translations: page.translations,
      site: page.site,
      ancestors: page.ancestors,
      currentPageTitle: page.seoMeta.title,
    },
  });

  return new Response(JSON.stringify({ html }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...renderBlockFragmentCorsHeaders(),
    },
  });
};
