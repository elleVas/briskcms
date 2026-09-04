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

// Called by apps/editor-app (canvas-frame.tsx/block-fragment-api-client.ts),
// never by a real visitor: editor-app runs on a different origin (port 4200
// in dev), so explicit CORS is needed here, scoped to EDITOR_APP_URL alone
// — the real authentication stays the preview token validated below (the
// same token as the preview route, see the visual editor plan, Day 1/3),
// and CORS only decides "which JS may read the response", not "who is
// authorized".
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

  // The same "indistinguishable from non-existent" collapse as the preview
  // route: a missing, expired or mismatched token and a page that does not
  // exist all get the same 404.
  const page = await getPreviewPageById(body.pageId, body.token);
  if (!page) {
    return new Response('Not found', {
      status: 404,
      headers: renderBlockFragmentCorsHeaders(),
    });
  }

  // The `children` have to be preserved when the block is a container — a
  // property change from the Inspector never touches them. It prefers the
  // ones the caller passed (already known client-side, with no race against
  // the draft save happening in parallel — see RenderBlockFragmentBody);
  // the server read stays only as a fallback for older calls that do not
  // pass them yet.
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
