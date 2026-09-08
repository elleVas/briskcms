import type { BlockAlign, ResponsiveBlockStyle } from '@brisk/shared-types';

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
 * The fixed gap the old flex `gap` used to add between root blocks. A
 * top-level block that does not customize `marginBottom` gets exactly the
 * same space as it did before this was configurable.
 */
export const DEFAULT_BLOCK_GAP = '4rem';

/**
 * `base` only, and deliberately: this margin is an inline style on the
 * spacing wrapper, and its DEFAULT depends on the block's position
 * (`isLast`) — neither of which the per-breakpoint rule emitter knows
 * about (ADR-0047). Rather than let a mobile margin be set and do nothing,
 * the editor hides these two fields at the narrow sizes; reworking the
 * spacing wrapper into real rules is the rest of Fase 3's to do, together
 * with the columns.
 */
export function rootBlockSpacingStyle(
  styleOverride: ResponsiveBlockStyle | undefined,
  isLast: boolean,
): string {
  const marginTop = styleOverride?.base.marginTop ?? '0';
  // The last block gets no default gap below it — `gap` never added one
  // after the final child, and an unconditional margin would add space at
  // the bottom of every page that was not there before. An explicit
  // override on the last block is still honoured: only the DEFAULT is
  // zeroed, not the customization.
  const marginBottom =
    styleOverride?.base.marginBottom ?? (isLast ? '0' : DEFAULT_BLOCK_GAP);
  return `margin-top: ${marginTop}; margin-bottom: ${marginBottom};`;
}

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

/**
 * Marks a wrapper whose bottom gap is the DEFAULT one rather than a value
 * somebody chose (`data-brisk-gap="default"`, canvas only).
 *
 * The canvas has to re-space root blocks when the list changes — appending
 * makes the previous last block no longer last, deleting one promotes its
 * neighbour — and the default gap is the only part of the spacing that
 * depends on a block's position. Without this marker the bridge cannot
 * tell "4rem because nobody said otherwise" from "4rem because someone
 * typed it", and re-spacing would silently overwrite the second. With it,
 * the bridge only ever changes what it is allowed to change.
 *
 * Editor-only, like `data-brisk-block-id`: nothing on the published page
 * re-spaces anything, so a visitor's HTML does not carry it.
 */
export function rootBlockDefaultGapAttr(
  styleOverride: ResponsiveBlockStyle | undefined,
  editable: boolean,
): 'default' | undefined {
  return editable && styleOverride?.base.marginBottom === undefined
    ? 'default'
    : undefined;
}

export const DEFAULT_GAP_ATTR = 'data-brisk-gap';
