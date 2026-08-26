import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import {
  buildBlockStyleOverridesCss,
  type Block,
  type BlockStyleOverride,
} from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { Button } from '../../components/ui/button.js';
import { renderBlockFragment } from '../../lib/block-fragment-api-client.js';
import { createPagePreviewToken } from '../../lib/preview-token-api-client.js';
import { PUBLIC_SITE_URL } from '../../lib/public-site-url.js';
import { GlobalStylesDialog } from '../global-styles-dialog.js';
import { IconButton } from '../icon-button.js';
import { LogoutButton } from '../logout-button.js';
import { siteQueryOptions } from '../site-queries.js';
import { useToast } from '../toast-provider.js';
import { useSiteThemeTokens } from '../use-site-theme-tokens.js';
import { BlockPicker, type BlockPickerCategory } from './block-picker.js';
import { BlockToolbarOverlay } from './block-toolbar-overlay.js';
import { BreakpointSelector, type Breakpoint } from './breakpoint-selector.js';
import {
  buildPreviewUrl,
  CanvasFrame,
  type EditingSection,
} from './canvas-frame.js';
import {
  computeDropTarget,
  findContainerAtPoint,
  type DropCandidateRect,
} from './compute-drop-target.js';
import { LayersPanel } from './layers-panel.js';
import { isRectVisibleInIframe, useIframeGeometry } from './overlay-layer.js';
import {
  cloneBlockWithNewIds,
  createBlockFromDescriptor,
  findBlockInTree,
  insertBlock,
  locateBlock,
  moveBlock,
  removeBlock,
  siblingsAt,
  updateBlockProps,
  updateBlockStyleOverride,
  type BlockTreeTarget,
} from './use-block-tree.js';
import { usePreviewBridge } from './use-preview-bridge.js';
import { usePropertyPatch } from './use-property-patch.js';

export interface CanvasEditorShellProps {
  backLink: ReactNode;
  /** Dropdown per passare ad un'altra pagina senza uscire dall'editor (barra in alto, vicino a `backLink`) — solo l'editor di pagina lo passa, l'editor Header/Footer no (non ha un concetto di "altre pagine tra cui scegliere"). */
  pageSwitcher?: ReactNode;
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
   * Sempre l'id di UNA PAGINA, anche quando si sta editando header/footer
   * (vedi canvas-frame.tsx) — il chiamante sceglie quale pagina usare come
   * contesto quando `editingSection` è presente.
   */
  pageId: string;
  editingSection?: EditingSection;
  /** Bumped solo su un rollback esplicito — stesso meccanismo di block-editor-shell.tsx (Puck) per resettare lo stato locale. */
  restoredAt?: number;
  children?: ReactNode;
}

/** Alla radice se il blocco selezionato non è un contenitore, altrimenti in coda ai suoi figli — regola "contenitore selezionato o radice" del piano dell'editor visuale, Giorno 3. */
function resolveInsertTarget(
  blocks: Block[],
  registry: BlockDescriptor[],
  selectedBlockId: string | null,
): { parentId: string | null; index: number } {
  if (selectedBlockId) {
    const selected = findBlockInTree(blocks, selectedBlockId);
    const descriptor = selected
      ? registry.find((d) => d.type === selected.type)
      : undefined;
    if (selected && descriptor?.isContainer) {
      return {
        parentId: selected.id ?? null,
        index: selected.children?.length ?? 0,
      };
    }
  }
  return { parentId: null, index: blocks.length };
}

/** Il field è testuale e marcato `inlineEditable` sul descrittore — l'unico caso in cui un doppio click deve montare TipTap. */
function isInlineEditableField(
  descriptor: BlockDescriptor | undefined,
  field: string,
): boolean {
  const fieldDescriptor = descriptor?.fields.find((f) => f.key === field);
  return (
    (fieldDescriptor?.kind === 'text' ||
      fieldDescriptor?.kind === 'textarea') &&
    Boolean(fieldDescriptor.inlineEditable)
  );
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
  const { t } = useTranslation();
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
  // Drag di un blocco NUOVO dalla sidebar (BlockPicker) verso il canvas —
  // a differenza di `bridge.activeDrag` (riordino di un blocco già
  // esistente, tracciato dall'iframe) qui il drag nasce nel genitore
  // stesso, quindi lo stato vive qui e non nel bridge. `pointer` è
  // page-relative (coordinate native del puntatore nel documento del
  // genitore), va convertito in coordinate iframe-relative prima di
  // riusare compute-drop-target.ts (che si aspetta la stessa unità di
  // bridge.blockRects).
  const [sidebarDrag, setSidebarDrag] = useState<{
    descriptor: BlockDescriptor;
    pointerX: number;
    pointerY: number;
  } | null>(null);

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

  // Stesso pattern "aggiusta lo stato durante il render" di sopra, applicato
  // al testo digitato dal vivo in TipTap (Giorno 4): `bridge.lastTextChange`
  // è già stato reso stato React da usePreviewBridge (il vero confine
  // esterno — il listener `message` — vive lì, dentro il suo handler),
  // quindi applicarlo qui è "stato derivato da una prop cambiata", non
  // "sincronizzare con un sistema esterno" — la forma che la regola
  // `react-hooks/set-state-in-effect` chiede di evitare in un effect. Solo
  // l'aggiornamento OTTICO dell'albero vive qui — pianificare il salvataggio
  // (scheduleTextChange, un vero side-effect: avvia un timer) resta in un
  // effect a parte sotto.
  const [lastAppliedTextChange, setLastAppliedTextChange] = useState(
    bridge.lastTextChange,
  );
  if (bridge.lastTextChange !== lastAppliedTextChange) {
    setLastAppliedTextChange(bridge.lastTextChange);
    if (bridge.lastTextChange) {
      const { blockId, field, text } = bridge.lastTextChange;
      setLocalBlocks((prev) =>
        updateBlockProps(prev, blockId, { [field]: text }),
      );
    }
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
    createPagePreviewToken(pageId).then((preview) => {
      if (!cancelled) {
        setToken(preview.token);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  const { scheduleChange, scheduleTextChange, scheduleStyleOverrideChange } =
    usePropertyPatch({
      pageId,
      token: token ?? '',
      onSaveDraft: (blockId, props) => {
        const next = updateBlockProps(localBlocksRef.current, blockId, props);
        setLocalBlocks(next);
        onChange(next);
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

  // Pianifica il salvataggio debounced del testo digitato dal vivo (Giorno
  // 4) — nessun setState qui (l'aggiornamento ottico vive nel blocco sopra),
  // solo il vero side-effect (scheduleTextChange avvia un timer), quindi un
  // effect è la sede corretta per questa parte.
  useEffect(() => {
    if (!bridge.lastTextChange) {
      return;
    }
    const { blockId, field, text } = bridge.lastTextChange;
    scheduleTextChange(blockId, field, text);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo a un NUOVO lastTextChange — scheduleTextChange è letta dal valore corrente, non serve rieseguire per un suo cambio di riferimento.
  }, [bridge.lastTextChange]);

  // Trigger per l'editing testo inline (Giorno 4) — reagisce ad ogni nuovo
  // doppio click riportato dal bridge (un oggetto nuovo per riferimento ad
  // ogni messaggio, vedi use-preview-bridge.ts), verifica che il field sia
  // davvero `inlineEditable` sul descrittore prima di montare TipTap.
  useEffect(() => {
    if (!bridge.lastDblClick?.field) {
      return;
    }
    const { blockId, field } = bridge.lastDblClick;
    const block = findBlockInTree(localBlocksRef.current, blockId);
    const descriptor = block
      ? registry.find((d) => d.type === block.type)
      : undefined;
    if (isInlineEditableField(descriptor, field)) {
      bridge.enterTextEdit(blockId, field);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo a un NUOVO lastDblClick — bridge.enterTextEdit/registry sono letti dal valore corrente, non serve rieseguire per un loro cambio di riferimento.
  }, [bridge.lastDblClick]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        bridge.exitTextEdit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bridge.exitTextEdit ha identità stabile (vedi usePreviewBridge), non serve nelle dipendenze.
  }, []);

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
        // cortesia di computeReorderedIds in layers-panel.tsx: non salvare
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

  function applyLocalChange(next: Block[]): void {
    setLocalBlocks(next);
    onChange(next);
  }

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
   * Rigenera e ripatcha per intero un blocco-contenitore (stesso
   * `editor:patch-block` di un cambio proprietà) dopo che uno dei suoi
   * figli è stato inserito/rimosso — non basta inserire/rimuovere SOLO quel
   * figlio nel DOM: l'euristica di risoluzione del contenitore in
   * preview-bridge-client.ts assume che `<slot/>` sia l'unico contenuto
   * dell'elemento radice del blocco-contenitore, falsa per Testimonials
   * (pulsanti di navigazione + segnaposto "contenitore vuoto" attorno allo
   * slot) e fragile in generale per qualunque "cornice" che dipenda dalla
   * presenza di figli. `treeWithUpdatedChildren` è l'albero già ricalcolato
   * dal chiamante DOPO la modifica (a differenza di `localBlocks` altrove
   * in questo file, che resta quello PRIMA finché serve).
   */
  async function patchParentBlock(
    parentId: string,
    treeWithUpdatedChildren: Block[],
  ): Promise<void> {
    if (!token) {
      return;
    }
    const parent = findBlockInTree(treeWithUpdatedChildren, parentId);
    if (!parent?.id) {
      return;
    }
    try {
      const html = await renderBlockFragment({
        pageId,
        token,
        blockId: parent.id,
        blockType: parent.type,
        props: parent.props,
        children: parent.children,
      });
      bridge.patchBlock(parent.id, html);
    } catch {
      // Resta nell'albero locale/nella bozza salvata, riappare corretto al
      // prossimo reload — stesso comportamento del fallimento di rete negli
      // altri rami di insertIntoCanvas sotto.
    }
  }

  /**
   * Renderizza il frammento del blocco APPENA creato (mai visto prima
   * dall'iframe, a differenza di usePropertyPatch che ne sostituisce uno
   * esistente) e lo inserisce nel canvas via `editor:insert-block` — senza
   * questo, il blocco resterebbe nell'albero locale/nella bozza salvata ma
   * invisibile finché l'iframe non si ricarica (il bug segnalato). I
   * `children` del blocco sono già noti qui (appena costruiti o clonati),
   * niente bisogno che il server li rilegga dalla bozza salvata — evita
   * anche la race fra salvataggio e lettura per un contenitore.
   * `beforeBlockId` è calcolato PRIMA di applicare l'inserimento
   * all'albero: è l'id di chi oggi occupa la posizione target, che dopo
   * l'inserimento si ritroverà spostato di uno.
   *
   * Per un inserimento ANNIDATO (`target.parentId` non nullo), vedi
   * `patchParentBlock` sopra — si ripatcha il genitore, non si inserisce il
   * figlio da solo.
   */
  async function insertIntoCanvas(
    block: Block & { id: string },
    target: BlockTreeTarget,
    nextBlocks: Block[],
  ): Promise<void> {
    if (!token) {
      return;
    }
    if (target.parentId !== null) {
      await patchParentBlock(target.parentId, nextBlocks);
      return;
    }
    const siblingsBefore = siblingsAt(localBlocks, target.parentId);
    const beforeBlockId = siblingsBefore[target.index]?.id ?? null;
    try {
      const html = await renderBlockFragment({
        pageId,
        token,
        blockId: block.id,
        blockType: block.type,
        props: block.props,
        children: block.children,
      });
      bridge.insertBlock(html, target.parentId, beforeBlockId);
    } catch {
      // Il blocco resta comunque nell'albero locale e nella bozza salvata
      // (applyLocalChange è già avvenuto) — ricomparirà nel canvas al
      // prossimo reload dell'iframe, stesso comportamento di oggi per
      // qualunque fallimento di rete.
    }
  }

  function handleInsert(descriptor: BlockDescriptor): void {
    const target = resolveInsertTarget(
      localBlocks,
      registry,
      bridge.selectedBlockId,
    );
    const newBlock = createBlockFromDescriptor(descriptor, registry);
    const next = insertBlock(localBlocks, newBlock, target);
    applyLocalChange(next);
    void insertIntoCanvas(newBlock, target, next);
  }

  function handleReorderRoot(orderedIds: string[]): void {
    let next = localBlocks;
    orderedIds.forEach((id, index) => {
      next = moveBlock(next, id, { parentId: null, index });
    });
    applyLocalChange(next);
    bridge.reorderBlocks(null, orderedIds);
  }

  function handleRemoveSelected(): void {
    if (!selectedBlock?.id) {
      return;
    }
    const location = locateBlock(localBlocks, selectedBlock.id);
    const next = removeBlock(localBlocks, selectedBlock.id);
    applyLocalChange(next);
    // Un blocco annidato rimosso può cambiare la "cornice" del suo
    // genitore (es. Testimonials nasconde di nuovo i pulsanti nav e
    // rimostra il segnaposto vuoto quando perde il suo ultimo figlio) —
    // stesso motivo per cui un inserimento annidato ripatcha il genitore
    // invece di toccare solo il nodo rimosso (vedi patchParentBlock sopra).
    // Un blocco di primo livello resta invece un semplice editor:remove-block.
    if (location?.parentId) {
      void patchParentBlock(location.parentId, next);
    } else {
      bridge.removeBlock(selectedBlock.id);
    }
  }

  function handlePublish(): void {
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

  // Sposta su/giù, duplica, inserisci prima/dopo — azioni della toolbar
  // contestuale (sostituisce l'Inspector a colonna fissa). Sposta/inserisci
  // sono scoped ai blocchi di primo livello (stesso limite del riordino via
  // drag, vedi compute-drop-target.ts); duplica funziona a qualunque
  // livello via `locateBlock`, che trova il vero genitore anche per un
  // blocco annidato.
  function handleMoveSelected(direction: -1 | 1): void {
    if (!selectedBlock?.id) {
      return;
    }
    const index = localBlocks.findIndex((b) => b.id === selectedBlock.id);
    if (index === -1) {
      return;
    }
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= localBlocks.length) {
      return;
    }
    const next = moveBlock(localBlocks, selectedBlock.id, {
      parentId: null,
      index: targetIndex,
    });
    applyLocalChange(next);
    bridge.reorderBlocks(
      null,
      next.map((block) => block.id as string),
    );
  }

  function handleDuplicateSelected(): void {
    if (!selectedBlock?.id) {
      return;
    }
    const location = locateBlock(localBlocks, selectedBlock.id);
    if (!location) {
      return;
    }
    const clone = cloneBlockWithNewIds(selectedBlock);
    const target: BlockTreeTarget = {
      parentId: location.parentId,
      index: location.index + 1,
    };
    const next = insertBlock(localBlocks, clone, target);
    applyLocalChange(next);
    void insertIntoCanvas(clone, target, next);
  }

  /**
   * "+" dentro a un contenitore-collezione selezionato (Testimonianze,
   * Team, Accordion, ...) — aggiunge un altro figlio del suo UNICO tipo
   * consentito (`allowedChildTypes[0]`) senza aprire il picker: non c'è
   * ambiguità da chiedere, è l'unico tipo sensato per quel contenitore
   * (stessa regola di createBlockFromDescriptor). Il pulsante compare solo
   * quando `descriptor.allowedChildTypes` ha esattamente un elemento (vedi
   * block-toolbar-overlay.tsx's canAddChild), quindi qui la ricerca nel
   * registry non dovrebbe mai fallire — se fallisse comunque (registry
   * disallineato), semplicemente non succede nulla.
   */
  function handleAddChild(): void {
    if (!selectedBlock?.id || !selectedDescriptor) {
      return;
    }
    const childType = selectedDescriptor.allowedChildTypes?.[0];
    const childDescriptor = childType
      ? registry.find((d) => d.type === childType)
      : undefined;
    if (!childDescriptor) {
      return;
    }
    const newChild = createBlockFromDescriptor(childDescriptor, registry);
    const target: BlockTreeTarget = {
      parentId: selectedBlock.id,
      index: selectedBlock.children?.length ?? 0,
    };
    const next = insertBlock(localBlocks, newChild, target);
    applyLocalChange(next);
    void insertIntoCanvas(newChild, target, next);
  }

  function handleInsertAtRoot(
    descriptor: BlockDescriptor,
    offset: 0 | 1,
  ): void {
    if (!selectedBlock?.id) {
      return;
    }
    const index = localBlocks.findIndex((b) => b.id === selectedBlock.id);
    if (index === -1) {
      return;
    }
    const newBlock = createBlockFromDescriptor(descriptor, registry);
    const target: BlockTreeTarget = { parentId: null, index: index + offset };
    const next = insertBlock(localBlocks, newBlock, target);
    applyLocalChange(next);
    void insertIntoCanvas(newBlock, target, next);
  }

  /**
   * Drag di un blocco nuovo dalla sidebar (BlockPicker) — mousedown+
   * movimento oltre la soglia lì dentro innesca questi tre callback (vedi
   * block-picker.tsx).
   */
  function handleSidebarDragStart(descriptor: BlockDescriptor): void {
    setSidebarDrag({ descriptor, pointerX: 0, pointerY: 0 });
  }

  function handleSidebarDragMove(pageX: number, pageY: number): void {
    setSidebarDrag((prev) =>
      prev ? { ...prev, pointerX: pageX, pointerY: pageY } : prev,
    );
  }

  /**
   * A differenza del click-to-insert (resolveInsertTarget, basato sul
   * blocco SELEZIONATO), un drag ha un vero punto di rilascio — usarlo per
   * decidere il contenitore invece della selezione era il bug segnalato dal
   * vivo: trascinare un blocco su un contenitore diverso da quello ancora
   * selezionato in precedenza lo annidava comunque in quest'ultimo, non in
   * quello visivamente sotto il puntatore, producendo un layout che sembrava
   * rotto (contenuto/toolbar posizionati altrove rispetto al drop reale).
   * `bridge.blockRects` include già ogni blocco annidato, non solo quelli di
   * primo livello (a differenza di `rootRects` sotto, scoped al riordino tra
   * fratelli) — qui si filtra ai soli blocchi che il registry marca come
   * contenitori, poi si sceglie il rect più piccolo (il contenitore più
   * profondo) che contiene il punto.
   */
  function handleSidebarDragEnd(
    descriptor: BlockDescriptor,
    pageX: number,
    pageY: number,
  ): void {
    setSidebarDrag(null);
    const isOverCanvas =
      pageX >= iframeGeometry.left &&
      pageX <= iframeGeometry.left + iframeGeometry.width &&
      pageY >= iframeGeometry.top;
    if (!isOverCanvas) {
      return;
    }
    const iframeX = pageX - iframeGeometry.left;
    const iframeY = pageY - iframeGeometry.top;
    const containerRects = bridge.blockRects.filter((rect) => {
      const block = findBlockInTree(localBlocks, rect.id);
      const blockDescriptor = block
        ? registry.find((d) => d.type === block.type)
        : undefined;
      return Boolean(blockDescriptor?.isContainer);
    });
    const hitContainerId = findContainerAtPoint(
      containerRects,
      iframeX,
      iframeY,
    );
    const hitContainer = hitContainerId
      ? findBlockInTree(localBlocks, hitContainerId)
      : null;
    const target: BlockTreeTarget = hitContainer?.id
      ? { parentId: hitContainer.id, index: hitContainer.children?.length ?? 0 }
      : {
          parentId: null,
          index:
            computeDropTarget(rootRects, '', iframeY)?.index ??
            localBlocks.length,
        };
    const newBlock = createBlockFromDescriptor(descriptor, registry);
    const next = insertBlock(localBlocks, newBlock, target);
    applyLocalChange(next);
    void insertIntoCanvas(newBlock, target, next);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-3 py-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {backLink}
          {pageSwitcher}
          <span>{statusText}</span>
          {actions}
        </div>
        <div className="flex items-center justify-center gap-2">
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
          <LogoutButton />
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
                canMoveUp={isSelectedRootLevel && selectedRootIndex > 0}
                canMoveDown={
                  isSelectedRootLevel &&
                  selectedRootIndex < localBlocks.length - 1
                }
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
              {sidebarDrag.descriptor.label}
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
                onReorderRoot={handleReorderRoot}
                onSelect={bridge.selectBlock}
              />
            </>
          )}
        </aside>
      </div>
      {children}
    </div>
  );
}
