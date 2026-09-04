import type { Block, BlockStyleOverride } from '@brisk/shared-types';
import { editorAppUrl } from './editor-app-url';

export interface RenderBlockFragmentBody {
  pageId: string;
  token: string;
  blockId: string;
  blockType: string;
  props: Record<string, unknown>;
  /**
   * When present, used directly rather than rebuilt by reading the saved
   * draft server-side (see render-block-fragment.ts) — the caller
   * (canvas-editor-shell.tsx) already knows the current tree, so there is no
   * need to read it back, and above all no race: the draft save and this
   * call start in parallel, and a server read has no guarantee of seeing
   * the save that just happened.
   */
  children?: Block[];
  /** The per-instance override (docs/adr/0022) — without this, changing ONE block's style from the canvas would not show until the iframe reloaded. */
  styleOverride?: BlockStyleOverride;
}

/**
 * Isolated from the route itself (render-block-fragment.ts) because that
 * file imports an .astro component — vitest, with this project's plain
 * config (no Astro Vite plugin registered), cannot transform an .astro
 * import in a test file's module graph. That route's end-to-end
 * verification (token, CSS scoping, CORS) was done live against the real
 * dev server rather than here — see the visual editor plan, Day 3.
 */
export function isValidRenderBlockFragmentBody(
  body: unknown,
): body is RenderBlockFragmentBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate['pageId'] === 'string' &&
    typeof candidate['token'] === 'string' &&
    typeof candidate['blockId'] === 'string' &&
    typeof candidate['blockType'] === 'string' &&
    typeof candidate['props'] === 'object' &&
    candidate['props'] !== null &&
    (candidate['children'] === undefined ||
      Array.isArray(candidate['children'])) &&
    (candidate['styleOverride'] === undefined ||
      (typeof candidate['styleOverride'] === 'object' &&
        candidate['styleOverride'] !== null))
  );
}

export function renderBlockFragmentCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': editorAppUrl(),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
