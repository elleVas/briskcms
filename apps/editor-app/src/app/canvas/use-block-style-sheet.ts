import { type MutableRefObject, useRef } from 'react';
import { buildBlockInstanceRulesCss, type Block } from '@brisk/shared-types';
import type { PreviewBridgeState } from './use-preview-bridge';

export interface BlockStyleSheet {
  /**
   * Sends the sheet again, built from `tree` — the draft as it stands when
   * omitted. Called after anything that changes which instances carry a
   * style: an edit to one, and a block arriving with a style of its own (a
   * duplicate, a paste, an undo that brings one back).
   */
  refresh: (tree?: Block[]) => void;
  /** Replaces the per-type tier with what a save returned, then sends the sheet. */
  replaceTypeCss: (css: string) => void;
}

/**
 * The block style sheet the iframe shows, both tiers at once.
 *
 * They travel together because they live in ONE `<style>` in there, and
 * because the order between them is what makes an instance beat its type —
 * pushing one without the other would leave the layer declaration referring
 * to rules that are not there.
 *
 * A style is a RULE since ADR-0047, not an inline attribute, so rendering a
 * block's fragment does not carry it: whoever puts a styled block on the
 * canvas has to send the sheet too.
 *
 * The per-type CSS is remembered rather than recomputed: it comes back from
 * the save that produced it, and the instance side changes far more often
 * than it does.
 */
export function useBlockStyleSheet(
  bridge: Pick<PreviewBridgeState, 'updateBlockStyleCss'>,
  localBlocksRef: MutableRefObject<Block[]>,
): BlockStyleSheet {
  const typeStyleCssRef = useRef('');

  function refresh(tree?: Block[]): void {
    const tiers = [
      typeStyleCssRef.current,
      buildBlockInstanceRulesCss([tree ?? localBlocksRef.current]),
    ].filter(Boolean);
    bridge.updateBlockStyleCss(
      tiers.length > 0
        ? ['@layer brisk.class, brisk.instance;', ...tiers].join('\n')
        : '',
    );
  }

  function replaceTypeCss(css: string): void {
    typeStyleCssRef.current = css;
    refresh();
  }

  return { refresh, replaceTypeCss };
}
