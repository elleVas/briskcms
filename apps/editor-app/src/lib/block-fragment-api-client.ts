import type { Block, BlockStyleOverride } from '@brisk/shared-types';
import { PUBLIC_SITE_URL } from './public-site-url';

export interface RenderBlockFragmentInput {
  pageId: string;
  token: string;
  blockId: string;
  blockType: string;
  props: Record<string, unknown>;
  /** The block's current children (when it is a container), already known on the client — this saves the server rebuilding them by reading the saved draft, which may not yet have taken in a save happening in parallel. */
  children?: Block[];
  /** The per-instance override (docs/adr/0022) — without this, a style change from the canvas would not show in the freshly patched fragment. */
  styleOverride?: BlockStyleOverride;
}

/**
 * Calls apps/public-site directly (never through apps/api): it is the only
 * app able to render an .astro component — see the visual editor plan, Day
 * 3. Cross-origin in dev (port 4321 against editor-app's 4200), which is
 * why that route has its own CORS scoped to this origin (see
 * render-block-fragment.ts). It does not go through http-client.ts: that
 * base URL points at apps/api, not at apps/public-site.
 */
export async function renderBlockFragment(
  input: RenderBlockFragmentInput,
): Promise<string> {
  const res = await fetch(`${PUBLIC_SITE_URL}/api/render-block-fragment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`render-block-fragment API error: ${res.status}`);
  }
  const body: { html: string } = await res.json();
  return body.html;
}
