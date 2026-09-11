import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Block, ExposedFields } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { PUBLIC_SITE_URL } from '../../lib/public-site-url';
import { useTranslation } from '../../lib/use-translation';
import { usePageList } from '../page-list-context';
import { BlockPicker, type BlockPickerCategory } from './block-picker';
import { TemplatePicker } from './template-picker';
import { BlockToolbarOverlay } from './block-toolbar-overlay';
import type { Breakpoint } from './breakpoint-selector';
import {
  buildPreviewUrl,
  CanvasFrame,
  type EditingSection,
} from './canvas-frame';
import { describeSelection } from './canvas-selection';
import { CanvasTopBar } from './canvas-top-bar';
import { CollapsibleSidePanel } from './collapsible-side-panel';
import { siblingDropRects } from './compute-drop-target';
import { LayerContextMenu } from './layer-context-menu';
import { LayersPanel } from './layers-panel';
import { isRectVisibleInIframe, useIframeGeometry } from './overlay-layer';
import { canHoldChild } from './use-block-tree';
import { useBlockStyleSheet } from './use-block-style-sheet';
import { useBlockTreeMutations } from './use-block-tree-mutations';
import { useCanvasDraft } from './use-canvas-draft';
import { useCanvasDragReorder } from './use-canvas-drag-reorder';
import { useCanvasPreviewToken } from './use-canvas-preview-token';
import { useCanvasShortcuts } from './use-canvas-shortcuts';
import { useMakeReusableSection } from './use-make-reusable-section';
import { useSelectedBlockEditing } from './use-selected-block-editing';
import { usePreviewBridge } from './use-preview-bridge';
import { useSidebarDrag } from './use-sidebar-drag';
import { useTextEdit } from './use-text-edit';

/**
 * The per-BLOCK slice of the section editor's expose controls. A function
 * rather than an inline object so the "no block id" case is answered once:
 * a block without an id cannot be keyed in `exposedFields` at all, and
 * offering the checkbox anyway would silently drop the choice.
 */
function buildSectionEditing(
  sectionEditing:
    | {
        exposedFields: ExposedFields;
        onToggleField: (blockId: string, field: string) => void;
      }
    | undefined,
  blockId: string | undefined,
): { exposed: string[]; onToggle: (field: string) => void } | undefined {
  if (!sectionEditing || !blockId) {
    return undefined;
  }
  return {
    exposed: sectionEditing.exposedFields[blockId] ?? [],
    onToggle: (field: string) => sectionEditing.onToggleField(blockId, field),
  };
}

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
  /** Present only in the reusable-section editor — see CanvasFrame's own prop. */
  sectionPreview?: { sectionId: string; locale: string };
  /**
   * Also section-editor only (docs/adr/0059): it puts an "a page may
   * change this" checkbox beside every field, which is how the agency
   * decides what a client may touch on an instance.
   */
  sectionEditing?: {
    exposedFields: ExposedFields;
    onToggleField: (blockId: string, field: string) => void;
  };
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
  sectionPreview,
  sectionEditing,
  restoredAt = 0,
  children,
}: CanvasEditorShellProps) {
  const { t, tLabel } = useTranslation();
  const { pick: pickPage } = usePageList();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridge = usePreviewBridge(iframeRef, PUBLIC_SITE_URL);
  const iframeGeometry = useIframeGeometry(iframeRef);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('base');
  // Where the layers context menu is, or null when closed. Position and
  // not just "open": it opens at the pointer, like every context menu.
  const [layerMenuAt, setLayerMenuAt] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Bumped where the canvas cannot be patched in place — replacing a block
  // with a reusable section, whose blocks the client does not hold
  // (docs/adr/0059). It is the `key` of CanvasFrame, so a bump remounts the
  // iframe with a fresh preview token.
  const [canvasNonce, setCanvasNonce] = useState(0);
  const reloadCanvas = useCallback(() => setCanvasNonce((n) => n + 1), []);

  const token = useCanvasPreviewToken(pageId, sectionPreview);
  const {
    localBlocks,
    setLocalBlocks,
    localBlocksRef,
    recordEditRef,
    scheduleChange,
    scheduleTextChange,
    scheduleStyleOverrideChange,
    scheduleVariantChange,
    flushAll,
  } = useCanvasDraft({
    blocks,
    pageId,
    restoredAt,
    token,
    sectionPreview,
    registry,
    translationRouting,
    onChange,
    bridge,
  });

  useTextEdit({
    bridge,
    registry,
    localBlocksRef,
    setLocalBlocks,
    scheduleTextChange,
    pickPage,
    // Translated HERE and sent into the iframe: the preview document is a
    // rendered site in the VISITOR's language, and its editing chrome has
    // to speak the editor's instead. See RichTextMenuLabels.
    menuLabels: {
      bold: t('canvas.richText.bold'),
      italic: t('canvas.richText.italic'),
      underline: t('canvas.richText.underline'),
      strike: t('canvas.richText.strike'),
      bulletList: t('canvas.richText.bulletList'),
      orderedList: t('canvas.richText.orderedList'),
      linkToPage: t('canvas.richText.linkToPage'),
      linkToUrl: t('canvas.richText.linkToUrl'),
      unlink: t('canvas.richText.unlink'),
      urlPrompt: t('canvas.richText.urlPrompt'),
    },
  });

  // A drag out of the SIDEBAR has no block in the tree yet, so it always
  // measures against the root — the level it drops at.
  const rootRects = siblingDropRects(
    localBlocks,
    bridge.blockRects,
    null,
  ).rects;

  const {
    selectedBlock,
    selectedDescriptor,
    selectedBlocks,
    selectedAncestry,
    selectedRect,
    isSelectedRootLevel,
    canMoveSelectedUp,
    canMoveSelectedDown,
  } = describeSelection(localBlocks, bridge, registry, tLabel);

  // Before the mutations, which send it too: a copy of a styled block is
  // a new id, and its rule has to reach the iframe with it.
  const styleSheet = useBlockStyleSheet(bridge, localBlocksRef);

  const {
    handleInsert,
    handleInsertBlocks,
    handleReorder,
    handleRemoveSelected,
    handleMoveSelected,
    handleDuplicateSelected,
    handlePasteMany,
    handleReparent,
    handleRemoveMany,
    handleDuplicateMany,
    handleReplaceSelected,
    handleAddChild,
    handleInsertAtRoot,
    insertNewBlockAt,
    undo,
    redo,
    canUndo,
    canRedo,
    recordEdit,
  } = useBlockTreeMutations({
    localBlocks,
    setLocalBlocks,
    onChange,
    registry,
    bridge,
    token,
    pageId,
    fragmentSection: sectionPreview,
    reloadCanvas,
    refreshStyleSheet: styleSheet.refresh,
    selectedBlock,
    selectedDescriptor,
  });
  const handleMakeReusable = useMakeReusableSection({
    siteId,
    selectedBlock,
    localBlocks,
    registry,
    handleReplaceSelected,
  });

  // Closes the loop opened by useCanvasDraft's `recordEditRef`. In an
  // effect rather than during render (React forbids touching a ref there,
  // and the linter says so): the burst callbacks only ever run from a
  // debounce timer, which needs a user action first, so they can never fire
  // before this has run.
  useEffect(() => {
    recordEditRef.current = recordEdit;
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

  useCanvasShortcuts({
    undo,
    redo,
    handleMoveSelected,
    handlePasteMany,
    handleRemoveMany,
    handleDuplicateMany,
    selectedBlocks,
  });

  const liveDropTarget = useCanvasDragReorder({
    localBlocks,
    bridge,
    sidebarDrag,
    rootRects,
    iframeGeometry,
    handleReorder,
  });

  const {
    handleChangeProp,
    handleChangeVariant,
    handleChangeAlign,
    handleChangeStyleOverride,
    typeStyle,
    saveTypeStyle,
  } = useSelectedBlockEditing({
    siteId,
    selectedBlock,
    selectedDescriptor,
    breakpoint,
    bridge,
    styleSheet,
    localBlocksRef,
    setLocalBlocks,
    onChange,
    patch: {
      scheduleChange,
      scheduleVariantChange,
      scheduleStyleOverrideChange,
    },
  });

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
      <CanvasTopBar
        backLink={backLink}
        pageSwitcher={pageSwitcher}
        languageSwitcher={languageSwitcher}
        statusText={statusText}
        actions={actions}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        breakpoint={breakpoint}
        onBreakpointChange={setBreakpoint}
        globalStyles={
          siteId
            ? {
                siteId,
                registry,
                categories,
                onSaveTypeStyle: saveTypeStyle,
              }
            : undefined
        }
        onOpenPreview={handleOpenPreview}
        onPublish={handlePublish}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <CollapsibleSidePanel
          side="left"
          title={t('canvas.insertBlock')}
          expandLabel={t('canvas.expandSidebar')}
          collapseLabel={t('canvas.collapseSidebar')}
        >
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
          {/* Not inside the section editor: a template dropped into a
              section would be a copy inside a thing that already IS
              the shared original, which is a muddle rather than a
              feature. */}
          {siteId && !sectionPreview && (
            <TemplatePicker siteId={siteId} onInsert={handleInsertBlocks} />
          )}
        </CollapsibleSidePanel>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <CanvasFrame
            key={canvasNonce}
            pageId={pageId}
            editingSection={editingSection}
            sectionPreview={sectionPreview}
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
                onChangeVariant={handleChangeVariant}
                sectionEditing={buildSectionEditing(
                  sectionEditing,
                  selectedBlock.id,
                )}
                ancestry={selectedAncestry}
                onSelectBlock={bridge.selectBlock}
                onMakeReusable={
                  // Not in the section editor (a section inside itself) and
                  // not in the header/footer, which are already applied to
                  // every page and have nothing to gain (docs/adr/0059). The
                  // hook itself says no inside a container that may not
                  // hold a section.
                  !sectionPreview && !editingSection
                    ? handleMakeReusable
                    : undefined
                }
                onChangeAlign={
                  // Root level, and the page's own content: the header and
                  // footer lists have no per-block wrapper to carry the
                  // attribute (they space their blocks with a flex `gap`),
                  // and a nested block's width is its container's business.
                  isSelectedRootLevel && !editingSection
                    ? handleChangeAlign
                    : undefined
                }
                breakpoint={breakpoint}
                typeStyle={typeStyle}
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
        <CollapsibleSidePanel
          side="right"
          title={t('canvas.layersTitle')}
          expandLabel={t('canvas.expandLayersPanel')}
          collapseLabel={t('canvas.collapseLayersPanel')}
        >
          <LayersPanel
            onContextMenu={(_blockId, x, y) => setLayerMenuAt({ x, y })}
            blocks={localBlocks}
            hoveredBlockId={bridge.hoveredBlockId}
            selectedBlockId={bridge.selectedBlockId}
            onReorder={handleReorder}
            onReparent={handleReparent}
            // The descriptors' own rules, as two predicates, so the panel
            // stays free of the registry. `canHoldChild` is the same rule
            // every insert path asks, so the panel cannot refuse a nesting
            // the picker would allow, or the other way round.
            isContainerType={(type) =>
              Boolean(registry.find((d) => d.type === type)?.isContainer)
            }
            canContain={(parentType, childType) =>
              canHoldChild(
                registry.find((d) => d.type === parentType),
                childType,
              )
            }
            selectedBlockIds={bridge.selectedBlockIds}
            onSelect={(blockId, additive) => {
              bridge.selectBlock(blockId, additive);
              // Only a plain click scrolls: adding a fourth block to a
              // selection should not yank the canvas away from the
              // three you are looking at.
              if (!additive) {
                bridge.scrollToBlock(blockId);
              }
            }}
          />
        </CollapsibleSidePanel>
      </div>
      {layerMenuAt && (
        <LayerContextMenu
          x={layerMenuAt.x}
          y={layerMenuAt.y}
          canMoveUp={canMoveSelectedUp}
          canMoveDown={canMoveSelectedDown}
          onDuplicate={handleDuplicateSelected}
          onDelete={handleRemoveSelected}
          onMoveUp={() => handleMoveSelected(-1)}
          onMoveDown={() => handleMoveSelected(1)}
          onClose={() => setLayerMenuAt(null)}
        />
      )}
      {children}
    </div>
  );
}
