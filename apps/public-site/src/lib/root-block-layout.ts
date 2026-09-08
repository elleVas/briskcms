import type { BlockAlign } from '@brisk/shared-types';

/**
 * The wrapper every ROOT-level block gets, in one place (ADR-0049).
 *
 * It exists twice at runtime and must agree with itself both times:
 * PublicPageContent.astro builds it server-side for the whole page, and
 * preview-bridge-client.ts builds it in the canvas for a block the iframe
 * has never seen. When those two drifted apart, an inserted block simply
 * had no wrapper — no spacing, and since this file gave the wrapper the
 * page's width too, no content column either: it rendered full-bleed until
 * the next reload. Two copies of a structure is how that happens, so there
 * is one.
 */
export const ROOT_BLOCK_CLASS = 'brisk-root-block';

/**
 * `content` is the default the CSS already applies, so it is written as
 * the absence of the attribute rather than as its own value — one less
 * thing in the published HTML of every page that never asked for it.
 */
export function rootBlockAlignAttr(
  align: BlockAlign | undefined,
): BlockAlign | undefined {
  return align && align !== 'content' ? align : undefined;
}
