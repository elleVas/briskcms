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
  /** Dropdown per passare ad un'altra pagina senza uscire dall'editor (barra in alto, vicino a `backLink`) — solo l'editor di pagina lo passa, l'editor Header/Footer no (non ha un concetto di "altre pagine tra cui scegliere"). */
  pageSwitcher?: ReactNode;
  /** i18n a livello di campo (see the plan) — dropdown per passare a un'altra lingua della STESSA PageGroup senza uscire dall'editor, accanto a `pageSwitcher`. Solo PageGroupEditorView lo passa. */
  languageSwitcher?: ReactNode;
  /**
   * i18n a livello di campo — presente solo quando si sta editando una
   * PageTranslation COLLEGATA (non diverged) di un PageGroup: decide se un
   * campo `translatable` cambiato va scritto sull'overlay `fieldValues`
   * della traduzione attiva invece che sulla struttura condivisa. Assente
   * per il vecchio editor Page, per l'editor Header/Footer, e per una
   * traduzione già scollegata (si comporta come il vecchio modello: sempre
   * `onChange`, mai un overlay separato).
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
   * Sempre l'id di UNA PageTranslation (i18n a livello di campo), anche
   * quando si sta editando header/footer (vedi canvas-frame.tsx) — il
   * chiamante sceglie quale traduzione usare come contesto quando
   * `editingSection` è presente (site-layout-section-editor-view.tsx usa la
   * traduzione "rappresentativa" di use-representative-page.ts).
   */
  pageId: string;
  editingSection?: EditingSection;
  /** Bumped solo su un rollback esplicito — stesso meccanismo di block-editor-shell.tsx (Puck) per resettare lo stato locale. */
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
  // Serve solo per l'override "a livello di componente" (docs/adr/0022,
  // pulsante "Stile" nella toolbar) — l'unico altro consumer di questa
  // query, global-styles-dialog.tsx, ne ha già una propria indipendente,
  // stessa queryKey quindi la cache di React Query le tiene comunque in
  // sync tra loro. `enabled: Boolean(siteId)` perché siteId è opzionale
  // qui (l'editor Header/Footer lo passa sempre, ma la prop resta
  // opzionale nel tipo) — niente fetch con un id vuoto.
  const { data: site } = useQuery({
    ...siteQueryOptions(siteId ?? ''),
    enabled: Boolean(siteId),
  });
  const { updateThemeTokens } = useSiteThemeTokens(siteId ?? '');
  /**
   * Richiesto dal vivo: su pagine lunghe/con molti blocchi, poter chiudere
   * ciascuna barra laterale per dare più spazio al canvas — due stati
   * indipendenti (sinistra: Inserisci blocco; destra: Livelli), nessuno
   * persistito, riparte sempre tutto aperto a un nuovo mount (stesso
   * comportamento di breakpoint/isGlobalStylesOpen sopra).
   */
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLayersPanelCollapsed, setIsLayersPanelCollapsed] = useState(false);

  // Copia locale mutata otticamente (le mutazioni sull'albero devono
  // riflettersi subito su Layers/Inspector, non solo dopo il round-trip col
  // server) — risincronizzata dalle props solo su un cambio di pagina o un
  // rollback esplicito (restoredAt), mai su ogni `blocks` in arrivo: il
  // chiamante scrive lo stesso valore appena rimandato da onChange,
  // risincronizzare anche lì rimonterebbe l'albero locale ad ogni salvataggio
  // riuscito, perdendo lo stato ottimistico più recente in caso di round-trip
  // lento. "Aggiusta lo stato durante il render" (pattern raccomandato da
  // React per resettare stato derivato da una prop-chiave cambiata) invece
  // di un `useEffect` con `setState` al suo interno — evita un render in più
  // a vuoto prima che l'albero locale rifletta il nuovo pageId/restoredAt.
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

  // Token separato da quello che canvas-frame.tsx si procura per il proprio
  // `src` — non consumante (vedi PreviewTokenPort), un secondo conio è
  // economico e non richiede di rifattorizzare l'interfaccia già testata di
  // CanvasFrame per farglielo esporre in su.
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

      // i18n a livello di campo: a una lingua LINKED diversa da quella di
      // default, un campo `translatable` non tocca mai la struttura
      // condivisa — va invece sull'overlay `fieldValues` di questa
      // traduzione. Guarda il tipo del blocco/il descrittore campo nel
      // momento del salvataggio effettivo (non al momento del render che
      // ha schedulato il debounce): la selezione può essere cambiata nel
      // frattempo.
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

  // Riordino diretto sul canvas (Giorno 3/4) — i rect dei soli blocchi di
  // primo livello, nello stesso ordine di `localBlocks` (non l'ordine
  // documento grezzo di `bridge.blockRects`, che include anche i blocchi
  // annidati): l'unico elenco su cui compute-drop-target.ts ha senso, dato
  // che il riordino resta scoped ai fratelli di primo livello (stessa
  // scelta di layers-panel.tsx).
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
  // A differenza di `isSelectedRootLevel` sopra (che resta root-only: governa
  // ANCORA inserisci-prima/dopo e i campi di spacing, entrambi validi solo
  // per un blocco di primo livello) — sposta su/giù ora funziona a
  // qualunque profondità, tramite `locateBlock` che trova il vero genitore
  // anche per un blocco annidato (stesso meccanismo già usato da duplica).
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

  // Ctrl/Cmd+Z per annullare, Ctrl/Cmd+Shift+Z (o Ctrl+Y) per ripetere —
  // scorciatoia standard di ogni editor con undo/redo. Mai in conflitto con
  // l'editing testo TipTap: quello vive DENTRO l'iframe sandboxed
  // (init-preview-bridge.ts), un documento separato i cui eventi da
  // tastiera non arrivano affatto a questo listener sul genitore. La sola
  // guardia utile qui è per gli input/textarea del GENITORE stesso (i vari
  // dialog/pannelli dell'editor) — lasciare il loro undo nativo del browser
  // invariato, non intercettarlo.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undo/redo sono ricreate ad ogni render da useBlockTreeMutations ma leggono già lo stato corrente al momento della chiamata — non serve riattaccare il listener per il loro cambio di riferimento.
  }, []);

  // Calcolo puramente derivato (nessuno stato proprio) — si aggiorna ad ogni
  // render insieme a `bridge.activeDrag`/`sidebarDrag`, così l'indicatore
  // segue il puntatore dal vivo senza bisogno di un effect dedicato. Per un
  // drag dalla sidebar non esiste un "blocco trascinato" già nell'albero da
  // escludere dai candidati — nessun id reale può eguagliare '', quindi
  // computeDropTarget considera tutti i blocchi di primo livello.
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

  // Applica il riordino al termine del drag — stesso pattern "aggiusta lo
  // stato durante il render" già usato sopra per lastTextChange: l'aggiornamento
  // ottico di `localBlocks` vive qui (mai in un effect, vedi
  // react-hooks/set-state-in-effect). `pendingReorderCommit` è un secondo
  // stato (non un ref: un ref non si può scrivere durante il render) che
  // porta l'albero appena riordinato a un effect dedicato sotto, l'unico
  // punto in cui è sicuro chiamare il vero side-effect verso il chiamante
  // (`onChange`, che a sua volta salva la bozza) — quell'effect non chiama
  // mai `setState`, si limita a leggere questo valore, quindi non ricade
  // nella regola che vieta `setState` sincrono dentro un effect.
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
        // Rilasciato dove già si trovava (nessuno spostamento reale) — stessa
        // cortesia di computeNestedReorder in layers-panel.tsx: non salvare
        // una bozza identica solo perché moveBlock restituisce sempre un
        // nuovo array per costruzione.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo a un NUOVO pendingReorderCommit — onChange/bridge.reorderBlocks sono letti dal valore corrente, non serve rieseguire per un loro cambio di riferimento.
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

  /** Override per-ISTANZA (docs/adr/0022) — popover sul blocco selezionato, tocca solo questo blocco. Stesso pattern "ottico subito, debounce per il salvataggio vero" di handleChangeProp sopra. */
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
   * Override per-TIPO (docs/adr/0022) — tocca `site.themeTokens.blockStyles[tipo]`:
   * OGNI istanza di quel tipo sul sito. Nessun aggiornamento ottico locale
   * dell'albero (a differenza di handleChangeStyleOverride sopra): non è
   * nell'albero della pagina, è nei theme tokens del sito —
   * `useSiteThemeTokens` invalida già la query del sito al successo,
   * `site.themeTokens` sopra si aggiorna da sé. Condivisa da due chiamanti
   * (docs/adr/0022, parte 2): il pulsante "Stile" della toolbar (tipo del
   * blocco selezionato) e la nuova modale "Stile globale" (qualunque tipo
   * scelto dalla lista, senza bisogno di una sua istanza sul canvas).
   */
  /**
   * Cattura l'errore qui, non nei chiamanti (handleChangeTypeStyle sotto,
   * e global-styles-dialog.tsx che la invoca via `onSaveTypeStyle`): un
   * solo punto per mostrare il toast invece di duplicarlo in entrambi i
   * chiamanti. Non rilancia — il canvas resta con l'ultimo CSS buono
   * finché il prossimo salvataggio non ritenta, invariato rispetto a
   * prima; l'unica differenza è che ora l'utente lo sa.
   */
  async function saveTypeStyle(
    blockType: string,
    style: BlockStyleOverride,
  ): Promise<void> {
    try {
      const updated = await updateThemeTokens({ blockType, style });
      // Aggiorna subito il <style> dentro l'iframe (docs/adr/0022) — senza
      // questo, ogni istanza già visibile di quel tipo resterebbe con
      // l'aspetto vecchio finché l'iframe non ricarica, anche se il
      // salvataggio è già andato a buon fine.
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

  /** Stessa `token` già in stato per `usePropertyPatch` — apre in una nuova scheda l'URL di anteprima, disponibile anche per una bozza mai pubblicata (a differenza di un link diretto al sito pubblico). */
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
