import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  buildBlockStyleOverridesCss,
  DEFAULT_VARIANT,
  withBreakpointStyle,
  type Block,
  type BlockAlign,
  type BlockStyleOverride,
  type ResponsiveBlockStyle,
} from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { useTranslation } from '../../lib/use-translation';
import { siteQueryOptions } from '../site-queries';
import { useToast } from '../toast-provider';
import { useSiteThemeTokens } from '../use-site-theme-tokens';
import type { Breakpoint } from './breakpoint-selector';
import type { BlockStyleSheet } from './use-block-style-sheet';
import {
  updateBlockAlign,
  updateBlockProps,
  updateBlockStyleOverride,
  updateBlockVariant,
} from './use-block-tree';
import type { PreviewBridgeState } from './use-preview-bridge';
import type { UsePropertyPatchResult } from './use-property-patch';

export interface UseSelectedBlockEditingParams {
  /** Present when the editor has a site to write per-type styles to. */
  siteId: string | undefined;
  selectedBlock: Block | null;
  selectedDescriptor: BlockDescriptor | undefined;
  breakpoint: Breakpoint;
  bridge: Pick<PreviewBridgeState, 'setBlockAlign'>;
  /** Shared with the tree mutations, which put styled blocks on the canvas too. */
  styleSheet: BlockStyleSheet;
  localBlocksRef: MutableRefObject<Block[]>;
  setLocalBlocks: Dispatch<SetStateAction<Block[]>>;
  onChange: (blocks: Block[]) => void;
  patch: Pick<
    UsePropertyPatchResult,
    'scheduleChange' | 'scheduleVariantChange' | 'scheduleStyleOverrideChange'
  >;
}

export interface SelectedBlockEditing {
  handleChangeProp: (key: string, value: unknown) => void;
  handleChangeVariant: (variant: string | undefined) => void;
  handleChangeAlign: (align: BlockAlign | undefined) => void;
  handleChangeStyleOverride: (styleOverride: BlockStyleOverride) => void;
  /** The per-type style the selected block's variant currently has, `undefined` with no site. */
  typeStyle: ResponsiveBlockStyle | undefined;
  /** Also what the Global styles dialog saves through, for a type with no instance on the canvas. */
  saveTypeStyle: (
    blockType: string,
    variant: string,
    style: ResponsiveBlockStyle,
  ) => Promise<void>;
}

/**
 * Every edit made to the selected block from its toolbar: a property, the
 * variant it wears, its width on the page, its own style and the style of
 * every block of its type.
 *
 * They share one pattern — show it now, save it after the debounce — and
 * one side effect none of them may forget: the style sheet inside the
 * iframe. A style is a RULE since ADR-0047, not an inline attribute, so
 * re-rendering a block's fragment does not carry it.
 */
export function useSelectedBlockEditing({
  siteId,
  selectedBlock,
  selectedDescriptor,
  breakpoint,
  bridge,
  styleSheet,
  localBlocksRef,
  setLocalBlocks,
  onChange,
  patch,
}: UseSelectedBlockEditingParams): SelectedBlockEditing {
  const { t } = useTranslation();
  const { toast } = useToast();
  // Only needed for the per-type style (docs/adr/0022). The Global styles
  // dialog has its own query with the same key, so the cache keeps them in
  // sync. Every editor that mounts the shell today passes a `siteId`;
  // `enabled` only keeps a future caller without one from fetching.
  const { data: site } = useQuery({
    ...siteQueryOptions(),
    enabled: Boolean(siteId),
  });
  const { updateThemeTokens } = useSiteThemeTokens(siteId ?? '');

  function handleChangeProp(key: string, value: unknown): void {
    // Hoisted to a local: TypeScript drops the narrowing of a PROPERTY as
    // soon as it is read inside a callback.
    const blockId = selectedBlock?.id;
    if (!blockId) {
      return;
    }
    const nextProps = { ...selectedBlock.props, [key]: value };
    setLocalBlocks((prev) => updateBlockProps(prev, blockId, nextProps));
    patch.scheduleChange(
      blockId,
      selectedBlock.type,
      key,
      nextProps,
      selectedBlock.children,
      // Without these the re-rendered fragment comes back stripped of its
      // per-instance class and its variant class, so editing a label made
      // the block lose its styling in the canvas until a reload.
      {
        styleOverride: selectedBlock.styleOverride,
        variant: selectedBlock.variant,
      },
    );
  }

  /** Which of the type's declared looks the selected block wears (ADR-0047) — a field of the block, so it travels the same route as the per-instance override rather than through `props`. */
  function handleChangeVariant(variant: string | undefined): void {
    const blockId = selectedBlock?.id;
    if (!blockId) {
      return;
    }
    setLocalBlocks((prev) => updateBlockVariant(prev, blockId, variant));
    patch.scheduleVariantChange(
      blockId,
      selectedBlock.type,
      selectedBlock.props,
      variant,
      selectedBlock.children,
      selectedBlock.styleOverride,
    );
  }

  /**
   * How much of the page's width the selected ROOT block claims (ADR-0049).
   *
   * No render round trip, unlike the variant: the value ends up as an
   * attribute on the wrapper AROUND the block, so re-rendering the block's
   * own HTML would not carry it. The bridge sets that attribute directly
   * and the CSS reflows the canvas with nothing to wait for.
   */
  function handleChangeAlign(align: BlockAlign | undefined): void {
    const blockId = selectedBlock?.id;
    if (!blockId) {
      return;
    }
    const next = updateBlockAlign(localBlocksRef.current, blockId, align);
    setLocalBlocks(next);
    onChange(next);
    bridge.setBlockAlign(blockId, align ?? null);
  }

  /**
   * The fields edit ONE size at a time — whichever the breakpoint selector
   * shows — and that flat override is merged back into the block's
   * per-breakpoint style here, so the fields stay a plain editor of a flat
   * override.
   */
  function handleChangeStyleOverride(styleOverride: BlockStyleOverride): void {
    const blockId = selectedBlock?.id;
    if (!blockId) {
      return;
    }
    const next = withBreakpointStyle(
      selectedBlock.styleOverride,
      breakpoint,
      styleOverride,
    );
    setLocalBlocks((prev) => updateBlockStyleOverride(prev, blockId, next));
    // Built here and handed over: the sheet used to read the draft ref,
    // which only catches up after the next render — so every style edit
    // sent the sheet as it was BEFORE that edit, and a control that fires
    // once (a swatch, a select) showed the previous value.
    styleSheet.refresh(
      updateBlockStyleOverride(localBlocksRef.current, blockId, next),
    );
    patch.scheduleStyleOverrideChange(
      blockId,
      selectedBlock.type,
      selectedBlock.props,
      next,
      selectedBlock.children,
      selectedBlock.variant,
    );
  }

  /**
   * Per-TYPE override (docs/adr/0022) — EVERY instance of that type across
   * the site. No optimistic update of the tree: it lives in the site's theme
   * tokens, not in the page.
   *
   * The error is caught here and not in the two callers (the toolbar and
   * the Global styles dialog), so the toast lives in one place. It does not
   * rethrow: the canvas keeps the last good CSS until the next save retries.
   */
  async function saveTypeStyle(
    blockType: string,
    variant: string,
    style: ResponsiveBlockStyle,
  ): Promise<void> {
    try {
      const updated = await updateThemeTokens({ blockType, variant, style });
      // Without this, every already-visible instance of that type keeps its
      // old look until the iframe reloads, though the save succeeded.
      styleSheet.replaceTypeCss(
        buildBlockStyleOverridesCss(updated.themeTokens?.blockStyles ?? {}),
      );
    } catch {
      toast(t('canvas.style.saveError'), 'destructive');
    }
  }

  // The variant the SELECTED block wears, not the type's default: "style
  // every Button like this one" means every Button that looks like this
  // one (ADR-0047).
  const selectedVariant = selectedBlock?.variant ?? DEFAULT_VARIANT;

  return {
    handleChangeProp,
    handleChangeVariant,
    handleChangeAlign,
    handleChangeStyleOverride,
    typeStyle:
      site && selectedDescriptor
        ? (site.themeTokens?.blockStyles[selectedDescriptor.type]?.[
            selectedVariant
          ] ?? { base: {} })
        : undefined,
    saveTypeStyle,
  };
}
