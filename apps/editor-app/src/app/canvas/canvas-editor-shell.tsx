import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Undo2,
} from 'lucide-react';
import {
  buildBlockStyleOverridesCss,
  type Block,
  type BlockStyleOverride,
} from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { Button } from '../../components/ui/button';
import { createTranslationPreviewToken } from '../../lib/preview-token-api-client';
import { PUBLIC_SITE_URL } from '../../lib/public-site-url';
import { useTranslation } from '../../lib/use-translation';
import { GlobalStylesDialog } from '../global-styles-dialog';
import { IconButton } from '../icon-button';
import { siteQueryOptions } from '../site-queries';
import { useToast } from '../toast-provider';
import { useSiteThemeTokens } from '../use-site-theme-tokens';
import { BlockPicker, type BlockPickerCategory } from './block-picker';
import { BlockToolbarOverlay } from './block-toolbar-overlay';
import { BreakpointSelector, type Breakpoint } from './breakpoint-selector';
import {
  buildPreviewUrl,
  CanvasFrame,
  type EditingSection,
} from './canvas-frame';
import {
  computeDropTarget,
  type DropCandidateRect,
} from './compute-drop-target';
import { LayersPanel } from './layers-panel';
import { isRectVisibleInIframe, useIframeGeometry } from './overlay-layer';
import {
  findBlockInTree,
  locateBlock,
  moveBlock,
  updateBlockProps,
  updateBlockStyleOverride,
} from './use-block-tree';
import { useBlockTreeMutations } from './use-block-tree-mutations';
import { usePreviewBridge } from './use-preview-bridge';
import { usePropertyPatch } from './use-property-patch';
import { useSidebarDrag } from './use-sidebar-drag';
import { useTextEdit } from './use-text-edit';

export interface CanvasEditorShellProps {
  backLink: ReactNode;
  /** Dropdown for switching to another page without leaving the editor (top bar, next to `backLink`) — only the page editor passes it; the Header/Footer editor does not (it has no notion of "other pages to choose between"). */
  pageSwitcher?: ReactNode;
  /** Field-level i18n (see the plan) — dropdown for switching to another language of the SAME PageGroup without leaving the editor, next to `pageSwitcher`. Only PageGroupEditorView passes it. */
  languageSwitcher?: ReactNode;
  /**
   * Field-level i18n — present only while editing a LINKED (not diverged)
   * PageTranslation of a PageGroup: it decides whether a changed
   * `translatable` field is written to the active translation's
   * `fieldValues` overlay instead of to the shared structure. Absent for
   * the old Page editor, for the Header/Footer editor, and for an already
   * unlinked translation (which behaves like the old model: always
   * `onChange`, never a separate overlay).
   */
  translationRouting?: {
    activeLocale: string;
    defaultLocale: string;
    onSaveFieldValue: (blockId: string, field: string, value: string) => void;
  };
  /** Se presente, mostra l'icona "Stile globale" nella barra in alto (Fase 2a del piano editor visuale, parte 2) — entrambi gli editor (pagina, Header/Footer) hanno un site a cui applicare lo stile. */
  siteId?: string;
  statusText: string;
  actions?: ReactNode;
  registry: BlockDescriptor[];
  categories: BlockPickerCategory[];
  blocks: Block[];
  /** Chiamato con l'albero aggiornato ad ogni mutazione (proprietà, testo, inserimento, riordino, rimozione) — il chiamante possiede il salvataggio bozza reale. */
  onChange: (blocks: Block[]) => void;
  onPublish: (blocks: Block[]) => unknown;
  /**
   * Always the id of ONE PageTranslation (field-level i18n), even while
   * editing the header/footer (see canvas-frame.tsx) — the caller picks
   * which translation to use as context when `editingSection` is present
   * (site-layout-section-editor-view.tsx uses the "representative"
   * translation from use-representative-page.ts).
   */
  pageId: string;
  editingSection?: EditingSection;
  /** Bumped only on an explicit rollback — the same mechanism block-editor-shell.tsx (Puck) used to reset local state. */
  restoredAt?: number;
  children?: ReactNode;
}

/**
 * Shell condivisa dall'editor di pagina e dall'editor Header/Footer (vedi
 * il piano dell'editor visuale, Giorno 4) — canvas Astro vero in un iframe,
 * Layers/Inspector/BlockPicker attorno, editing di testo inline via TipTap
 * montato sul posto. Sostituisce block-editor-shell.tsx (Puck).
 */
export function CanvasEditorShell({
  backLink,
  pageSwitcher,
  languageSwitcher,
  translationRouting,
  siteId,
  statusText,
  actions,
  registry,
  categories,
  blocks,
  onChange,
  onPublish,
  pageId,
  editingSection,
  restoredAt = 0,
  children,
}: CanvasEditorShellProps) {
  const { t, tLabel } = useTranslation();
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridge = usePreviewBridge(iframeRef, PUBLIC_SITE_URL);
  const iframeGeometry = useIframeGeometry(iframeRef);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');
  const [isGlobalStylesOpen, setIsGlobalStylesOpen] = useState(false);
  // Only needed for the "component-level" override (docs/adr/0022, the
  // toolbar's "Style" button) — this query's only other consumer,
  // global-styles-dialog.tsx, already has an independent one of its own,
  // with the same queryKey, so React Query's cache keeps them in sync
  // anyway. `enabled: Boolean(siteId)` because siteId is optional here
  // (the Header/Footer editor always passes it, but the prop stays
  // optional in the type) — no fetch with an empty id.
  const { data: site } = useQuery({
    ...siteQueryOptions(siteId ?? ''),
    enabled: Boolean(siteId),
  });
  const { updateThemeTokens } = useSiteThemeTokens(siteId ?? '');
  /**
   * Asked for from live use: on long pages with many blocks, being able to
   * collapse each sidebar to give the canvas more room — two independent
   * states (left: Insert block; right: Layers), neither persisted, both
   * starting open again on a new mount (the same behaviour as
   * breakpoint/isGlobalStylesOpen above).
   */
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLayersPanelCollapsed, setIsLayersPanelCollapsed] = useState(false);

  // A locally mutated optimistic copy (tree mutations have to show up in
  // Layers/Inspector immediately, not only after the server round-trip) —
  // resynced from props only on a page change or an explicit rollback
  // (restoredAt), never on every incoming `blocks`: the caller writes back
  // the same value onChange just sent, and resyncing there too would remount
  // the local tree on every successful save, losing the most recent
  // optimistic state whenever the round-trip is slow. "Adjust state during
  // render" (React's recommended pattern for resetting state derived from a
  // changed key prop) rather than a `useEffect` with a `setState` inside —
  // it avoids one wasted render before the local tree reflects the new
  // pageId/restoredAt.
  const syncKey = `${pageId}:${restoredAt}`;
  const [lastSyncKey, setLastSyncKey] = useState(syncKey);
  const [localBlocks, setLocalBlocks] = useState(blocks);
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    setLocalBlocks(blocks);
  }

  const localBlocksRef = useRef(localBlocks);
  useEffect(() => {
    localBlocksRef.current = localBlocks;
  });

  // A separate token from the one canvas-frame.tsx mints for its own `src`
  // — non-consuming (see PreviewTokenPort), so a second minting is cheap
  // and does not require refactoring CanvasFrame's already-tested interface
  // to expose it upwards.
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    createTranslationPreviewToken(pageId).then((preview) => {
      if (!cancelled) {
        setToken(preview.token);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  const {
    scheduleChange,
    scheduleTextChange,
    scheduleStyleOverrideChange,
    flushAll,
  } = usePropertyPatch({
    pageId,
    token: token ?? '',
    onSaveDraft: (blockId, changedKey, props) => {
      const next = updateBlockProps(localBlocksRef.current, blockId, props);
      setLocalBlocks(next);

      // Field-level i18n: in a LINKED language other than the default, a
      // `translatable` field never touches the shared structure — it goes
      // to this translation's own `fieldValues` overlay instead. It reads
      // the block type and field descriptor at the moment of the actual
      // save (not at the render that scheduled the debounce): the
      // selection may have changed in between.
      const changedValue = props[changedKey];
      const block = findBlockInTree(next, blockId);
      const descriptor = block
        ? registry.find((d) => d.type === block.type)
        : undefined;
      const fieldDescriptor = descriptor?.fields.find(
        (f) => f.key === changedKey,
      );
      const isTranslatableFieldValue =
        translationRouting &&
        translationRouting.activeLocale !== translationRouting.defaultLocale &&
        fieldDescriptor &&
        'translatable' in fieldDescriptor &&
        fieldDescriptor.translatable &&
        typeof changedValue === 'string';

      if (isTranslatableFieldValue) {
        translationRouting.onSaveFieldValue(blockId, changedKey, changedValue);
      } else {
        onChange(next);
      }
    },
    onSaveStyleOverride: (blockId, styleOverride) => {
      const next = updateBlockStyleOverride(
        localBlocksRef.current,
        blockId,
        styleOverride,
      );
      setLocalBlocks(next);
      onChange(next);
    },
    patchBlock: bridge.patchBlock,
  });

  useTextEdit({
    bridge,
    registry,
    localBlocksRef,
    setLocalBlocks,
    scheduleTextChange,
  });

  // Direct reordering on the canvas (Day 3/4) — the rects of top-level
  // blocks only, in the same order as `localBlocks` (not the raw document
  // order of `bridge.blockRects`, which also includes nested blocks): the
  // only list compute-drop-target.ts makes sense against, given that
  // reordering stays scoped to top-level siblings (the same choice
  // layers-panel.tsx made).
  const rootRects: DropCandidateRect[] = localBlocks.flatMap((block) => {
    if (!block.id) {
      return [];
    }
    const rect = bridge.blockRects.find((r) => r.id === block.id);
    return rect ? [{ id: block.id, top: rect.top, height: rect.height }] : [];
  });

  const selectedBlock = bridge.selectedBlockId
    ? findBlockInTree(localBlocks, bridge.selectedBlockId)
    : null;
  const selectedDescriptor = selectedBlock
    ? registry.find((d) => d.type === selectedBlock.type)
    : undefined;
  const selectedRect = bridge.selectedBlockId
    ? bridge.blockRects.find((r) => r.id === bridge.selectedBlockId)
    : undefined;
  const selectedRootIndex = selectedBlock?.id
    ? localBlocks.findIndex((b) => b.id === selectedBlock.id)
    : -1;
  const isSelectedRootLevel = selectedRootIndex !== -1;
  // Unlike `isSelectedRootLevel` above (which stays root-only: it STILL
  // governs insert-before/after and the spacing fields, both valid for a
  // top-level block alone) — move up/down now works at any depth, through
  // `locateBlock`, which finds the real parent even for a nested block (the
  // same mechanism duplicate already used).
  const selectedLocation = selectedBlock?.id
    ? locateBlock(localBlocks, selectedBlock.id)
    : null;
  const selectedSiblings = selectedLocation
    ? ((selectedLocation.parentId
        ? findBlockInTree(localBlocks, selectedLocation.parentId)?.children
        : localBlocks) ?? [])
    : [];
  const canMoveSelectedUp = selectedLocation
    ? selectedLocation.index > 0
    : false;
  const canMoveSelectedDown = selectedLocation
    ? selectedLocation.index < selectedSiblings.length - 1
    : false;

  const {
    handleInsert,
    handleReorder,
    handleRemoveSelected,
    handleMoveSelected,
    handleDuplicateSelected,
    handleAddChild,
    handleInsertAtRoot,
    insertNewBlockAt,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBlockTreeMutations({
    localBlocks,
    setLocalBlocks,
    onChange,
    registry,
    bridge,
    token,
    pageId,
    selectedBlock,
    selectedDescriptor,
  });

  const {
    sidebarDrag,
    handleSidebarDragStart,
    handleSidebarDragMove,
    handleSidebarDragEnd,
  } = useSidebarDrag({
    localBlocks,
    registry,
    iframeGeometry,
    rootRects,
    blockRects: bridge.blockRects,
    insertNewBlockAt,
  });

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) to redo — the standard
  // shortcut in every editor with undo/redo. Never in conflict with TipTap
  // text editing: that lives INSIDE the sandboxed iframe
  // (init-preview-bridge.ts), a separate document whose keyboard events
  // never reach this listener on the parent at all. The only guard worth
  // having here is for the PARENT's own inputs/textareas (the editor's
  // various dialogs and panels) — leaving their native browser undo alone
  // rather than intercepting it.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isUndoRedoKey =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z';
      const isRedoKey =
        (isUndoRedoKey && event.shiftKey) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y');
      if (!isUndoRedoKey && !isRedoKey) {
        return;
      }
      const active = document.activeElement;
      const isEditingText =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (isEditingText) {
        return;
      }
      event.preventDefault();
      if (isRedoKey) {
        redo();
      } else {
        undo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undo/redo are recreated on every render by useBlockTreeMutations but already read current state at call time, so there is no need to reattach the listener when their identity changes.
  }, []);

  // A purely derived computation (no state of its own) — it updates on
  // every render alongside `bridge.activeDrag`/`sidebarDrag`, so the
  // indicator follows the pointer live without a dedicated effect. For a
  // drag out of the sidebar there is no "dragged block" already in the tree
  // to exclude from the candidates — no real id can equal '', so
  // computeDropTarget considers every top-level block.
  const liveDropTarget = bridge.activeDrag
    ? computeDropTarget(
        rootRects,
        bridge.activeDrag.blockId,
        bridge.activeDrag.pointer.y,
      )
    : sidebarDrag
      ? computeDropTarget(
          rootRects,
          '',
          sidebarDrag.pointerY - iframeGeometry.top,
        )
      : null;

  // Applies the reorder once the drag ends — the same "adjust state during
  // render" pattern already used above for lastTextChange: the optimistic
  // update of `localBlocks` lives here (never in an effect, see
  // react-hooks/set-state-in-effect). `pendingReorderCommit` is a second
  // piece of state (not a ref: a ref cannot be written during render) that
  // carries the freshly reordered tree to a dedicated effect below, the one
  // place where it is safe to call the real side effect towards the caller
  // (`onChange`, which in turn saves the draft) — that effect never calls
  // `setState`, it only reads this value, so it does not fall foul of the
  // rule against synchronous `setState` inside an effect.
  const [lastAppliedDragEnd, setLastAppliedDragEnd] = useState(
    bridge.dragEnded,
  );
  const [pendingReorderCommit, setPendingReorderCommit] = useState<
    Block[] | null
  >(null);
  if (bridge.dragEnded !== lastAppliedDragEnd) {
    setLastAppliedDragEnd(bridge.dragEnded);
    if (bridge.dragEnded) {
      const { blockId, pointer } = bridge.dragEnded;
      const dropTarget = computeDropTarget(rootRects, blockId, pointer.y);
      if (dropTarget) {
        const next = moveBlock(localBlocks, blockId, {
          parentId: null,
          index: dropTarget.index,
        });
        // Dropped where it already was (no real movement) — the same
        // courtesy computeNestedReorder extends in layers-panel.tsx: do not
        // save an identical draft just because moveBlock always returns a
        // new array by construction.
        const orderUnchanged = next.every(
          (block, index) => block.id === localBlocks[index]?.id,
        );
        if (!orderUnchanged) {
          setLocalBlocks(next);
          setPendingReorderCommit(next);
        }
      }
    }
  }
  useEffect(() => {
    if (pendingReorderCommit) {
      onChange(pendingReorderCommit);
      bridge.reorderBlocks(
        null,
        pendingReorderCommit.map((block) => block.id as string),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts only to a NEW pendingReorderCommit; onChange/bridge.reorderBlocks are read from their current value, so there is no need to re-run when their identity changes.
  }, [pendingReorderCommit]);

  function handleChangeProp(key: string, value: unknown): void {
    if (!selectedBlock?.id) {
      return;
    }
    const nextProps = { ...selectedBlock.props, [key]: value };
    setLocalBlocks((prev) =>
      updateBlockProps(prev, selectedBlock.id as string, nextProps),
    );
    scheduleChange(
      selectedBlock.id,
      selectedBlock.type,
      key,
      nextProps,
      selectedBlock.children,
    );
  }

  /** Per-INSTANCE override (docs/adr/0022) — a popover on the selected block, touching only that block. Same "optimistic immediately, debounce the real save" pattern as handleChangeProp above. */
  function handleChangeStyleOverride(styleOverride: BlockStyleOverride): void {
    if (!selectedBlock?.id) {
      return;
    }
    setLocalBlocks((prev) =>
      updateBlockStyleOverride(prev, selectedBlock.id as string, styleOverride),
    );
    scheduleStyleOverrideChange(
      selectedBlock.id,
      selectedBlock.type,
      selectedBlock.props,
      styleOverride,
      selectedBlock.children,
    );
  }

  /**
   * Per-TYPE override (docs/adr/0022) — touches `site.themeTokens.blockStyles[type]`:
   * EVERY instance of that type across the site. No local optimistic update
   * of the tree (unlike handleChangeStyleOverride above): it is not in the
   * page's tree, it is in the site's theme tokens — `useSiteThemeTokens`
   * already invalidates the site query on success, so `site.themeTokens`
   * above updates by itself. Shared by two callers (docs/adr/0022, part 2):
   * the toolbar's "Style" button (the selected block's type) and the new
   * "Global style" dialog (any type picked from the list, with no need for
   * an instance of it on the canvas).
   */
  /**
   * The error is caught here, not in the callers (handleChangeTypeStyle
   * below, and global-styles-dialog.tsx which calls it through
   * `onSaveTypeStyle`): one place to show the toast instead of duplicating
   * it in both. It does not rethrow — the canvas keeps the last good CSS
   * until the next save retries, unchanged from before; the only difference
   * is that the user now knows.
   */
  async function saveTypeStyle(
    blockType: string,
    style: BlockStyleOverride,
  ): Promise<void> {
    try {
      const updated = await updateThemeTokens({ blockType, style });
      // Updates the <style> inside the iframe straight away (docs/adr/0022)
      // — without this, every already-visible instance of that type would
      // keep its old look until the iframe reloads, even though the save
      // already succeeded.
      bridge.updateBlockStyleCss(
        buildBlockStyleOverridesCss(updated.themeTokens?.blockStyles ?? {}),
      );
    } catch {
      toast(t('canvas.style.saveError'), 'destructive');
    }
  }

  function handleChangeTypeStyle(style: BlockStyleOverride): void {
    if (!selectedDescriptor) {
      return;
    }
    void saveTypeStyle(selectedDescriptor.type, style);
  }

  /**
   * Firing any still-pending debounced save NOW (instead of waiting out its
   * timer) narrows, but doesn't fully close, the gap between "last
   * keystroke" and "what gets published": the old Page model's onPublish
   * re-sent the whole current tree directly (bypassing the debounce
   * entirely), which the new i18n split model can't safely replicate — a
   * translatable field's value can't be reconstructed as either
   * PageGroup.content or a fieldValues overlay from the merged, currently-
   * displayed tree alone (see the plan / usePageGroupEditor's own comment).
   * A residual, narrow race remains: publishing in the same tick as a
   * keystroke could still race the just-flushed save's own network
   * round-trip.
   */
  function handlePublish(): void {
    flushAll();
    onPublish(localBlocksRef.current);
  }

  /** The same `token` already in state for `usePropertyPatch` — opens the preview URL in a new tab, available even for a draft that was never published (unlike a direct link to the public site). */
  function handleOpenPreview(): void {
    if (!token) {
      return;
    }
    window.open(
      buildPreviewUrl(pageId, token, editingSection),
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-3 py-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {backLink}
          {pageSwitcher}
          {languageSwitcher}
          <span>{statusText}</span>
          {actions}
        </div>
        <div className="flex items-center justify-center gap-2">
          <IconButton
            label={t('canvas.undo')}
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo2 />
          </IconButton>
          <IconButton
            label={t('canvas.redo')}
            onClick={redo}
            disabled={!canRedo}
          >
            <Redo2 />
          </IconButton>
          <BreakpointSelector value={breakpoint} onChange={setBreakpoint} />
          {siteId && (
            <IconButton
              label={t('globalStyles.open')}
              onClick={() => setIsGlobalStylesOpen(true)}
            >
              <Palette />
            </IconButton>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenPreview}>
            {t('canvas.preview')}
          </Button>
          <Button size="sm" onClick={handlePublish}>
            {t('canvas.publish')}
          </Button>
        </div>
      </div>
      {siteId && (
        <GlobalStylesDialog
          siteId={siteId}
          open={isGlobalStylesOpen}
          onOpenChange={setIsGlobalStylesOpen}
          registry={registry}
          categories={categories}
          onSaveTypeStyle={saveTypeStyle}
        />
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <aside
          className={
            isSidebarCollapsed
              ? 'flex w-10 shrink-0 flex-col items-center border-r py-3'
              : 'w-64 shrink-0 overflow-y-auto border-r p-3'
          }
        >
          <IconButton
            label={
              isSidebarCollapsed
                ? t('canvas.expandSidebar')
                : t('canvas.collapseSidebar')
            }
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            className={isSidebarCollapsed ? undefined : 'mb-2 -ml-1'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </IconButton>
          {!isSidebarCollapsed && (
            <>
              <h3 className="mb-2 text-sm font-medium">
                {t('canvas.insertBlock')}
              </h3>
              <BlockPicker
                categories={categories}
                registry={registry}
                onInsert={handleInsert}
                drag={{
                  onDragStart: handleSidebarDragStart,
                  onDragMove: handleSidebarDragMove,
                  onDragEnd: handleSidebarDragEnd,
                }}
              />
            </>
          )}
        </aside>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <CanvasFrame
            pageId={pageId}
            editingSection={editingSection}
            iframeRef={iframeRef}
            bridge={bridge}
            dropIndicatorTop={liveDropTarget?.indicatorTop}
            breakpoint={breakpoint}
          />
          {selectedBlock &&
            selectedDescriptor &&
            selectedRect &&
            isRectVisibleInIframe(iframeGeometry, selectedRect) && (
              <BlockToolbarOverlay
                iframeRef={iframeRef}
                block={selectedBlock}
                descriptor={selectedDescriptor}
                rect={selectedRect}
                isRootLevel={isSelectedRootLevel}
                canMoveUp={canMoveSelectedUp}
                canMoveDown={canMoveSelectedDown}
                registry={registry}
                categories={categories}
                onChangeProp={handleChangeProp}
                typeStyle={
                  site
                    ? (site.themeTokens?.blockStyles[selectedDescriptor.type] ??
                      {})
                    : undefined
                }
                onChangeTypeStyle={site ? handleChangeTypeStyle : undefined}
                onChangeInstanceStyle={handleChangeStyleOverride}
                onMoveUp={() => handleMoveSelected(-1)}
                onMoveDown={() => handleMoveSelected(1)}
                onDuplicate={handleDuplicateSelected}
                onDelete={handleRemoveSelected}
                onInsertBefore={(descriptor) =>
                  handleInsertAtRoot(descriptor, 0)
                }
                onInsertAfter={(descriptor) =>
                  handleInsertAtRoot(descriptor, 1)
                }
                onAddChild={handleAddChild}
              />
            )}
          {sidebarDrag && (
            <div
              data-testid="sidebar-drag-ghost"
              className="pointer-events-none fixed z-50 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow-md"
              style={{
                top: sidebarDrag.pointerY + 12,
                left: sidebarDrag.pointerX + 12,
              }}
            >
              {tLabel(sidebarDrag.descriptor.label)}
            </div>
          )}
        </div>
        <aside
          className={
            isLayersPanelCollapsed
              ? 'flex w-10 shrink-0 flex-col items-center border-l py-3'
              : 'w-64 shrink-0 overflow-y-auto border-l p-3'
          }
        >
          <IconButton
            label={
              isLayersPanelCollapsed
                ? t('canvas.expandLayersPanel')
                : t('canvas.collapseLayersPanel')
            }
            onClick={() => setIsLayersPanelCollapsed((collapsed) => !collapsed)}
            className={
              isLayersPanelCollapsed ? undefined : 'mb-2 -mr-1 self-end'
            }
          >
            {isLayersPanelCollapsed ? <PanelRightOpen /> : <PanelRightClose />}
          </IconButton>
          {!isLayersPanelCollapsed && (
            <>
              <h3 className="mb-2 text-sm font-medium">
                {t('canvas.layersTitle')}
              </h3>
              <LayersPanel
                blocks={localBlocks}
                hoveredBlockId={bridge.hoveredBlockId}
                selectedBlockId={bridge.selectedBlockId}
                onReorder={handleReorder}
                onSelect={(blockId) => {
                  bridge.selectBlock(blockId);
                  bridge.scrollToBlock(blockId);
                }}
              />
            </>
          )}
        </aside>
      </div>
      {children}
    </div>
  );
}
