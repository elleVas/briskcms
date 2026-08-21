import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { createPagePreviewToken } from '../../lib/preview-token-api-client.js';
import { PUBLIC_SITE_URL } from '../../lib/public-site-url.js';
import { LogoutButton } from '../logout-button.js';
import { BlockPicker, type BlockPickerCategory } from './block-picker.js';
import { CanvasFrame, type EditingSection } from './canvas-frame.js';
import {
  computeDropTarget,
  type DropCandidateRect,
} from './compute-drop-target.js';
import { InspectorPanel } from './inspector-panel.js';
import { LayersPanel } from './layers-panel.js';
import {
  findBlockInTree,
  insertBlock,
  moveBlock,
  removeBlock,
  updateBlockProps,
} from './use-block-tree.js';
import { usePreviewBridge } from './use-preview-bridge.js';
import { usePropertyPatch } from './use-property-patch.js';

export interface CanvasEditorShellProps {
  backLink: ReactNode;
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridge = usePreviewBridge(iframeRef, PUBLIC_SITE_URL);

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

  const { scheduleChange, scheduleTextChange } = usePropertyPatch({
    pageId,
    token: token ?? '',
    onSaveDraft: (blockId, props) => {
      const next = updateBlockProps(localBlocksRef.current, blockId, props);
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
  // render insieme a `bridge.activeDrag`, così l'indicatore segue il
  // puntatore dal vivo senza bisogno di un effect dedicato.
  const liveDropTarget = bridge.activeDrag
    ? computeDropTarget(
        rootRects,
        bridge.activeDrag.blockId,
        bridge.activeDrag.pointer.y,
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo a un NUOVO pendingReorderCommit — onChange è letta dal valore corrente, non serve rieseguire per un suo cambio di riferimento.
  }, [pendingReorderCommit]);

  const selectedBlock = bridge.selectedBlockId
    ? findBlockInTree(localBlocks, bridge.selectedBlockId)
    : null;
  const selectedDescriptor = selectedBlock
    ? registry.find((d) => d.type === selectedBlock.type)
    : undefined;

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
    scheduleChange(selectedBlock.id, selectedBlock.type, nextProps);
  }

  function handleInsert(descriptor: BlockDescriptor): void {
    const target = resolveInsertTarget(
      localBlocks,
      registry,
      bridge.selectedBlockId,
    );
    const newBlock: Block = {
      id: crypto.randomUUID(),
      type: descriptor.type,
      props: descriptor.defaultProps,
      ...(descriptor.isContainer ? { children: [] } : {}),
    };
    applyLocalChange(insertBlock(localBlocks, newBlock, target));
  }

  function handleReorderRoot(orderedIds: string[]): void {
    let next = localBlocks;
    orderedIds.forEach((id, index) => {
      next = moveBlock(next, id, { parentId: null, index });
    });
    applyLocalChange(next);
  }

  function handleRemoveSelected(): void {
    if (!selectedBlock?.id) {
      return;
    }
    applyLocalChange(removeBlock(localBlocks, selectedBlock.id));
  }

  function handlePublish(): void {
    onPublish(localBlocksRef.current);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between border-b px-3 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {backLink}
          <span>{statusText}</span>
          {actions}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded bg-primary px-2 py-1 text-primary-foreground hover:opacity-90"
            onClick={handlePublish}
          >
            {t('canvas.publish')}
          </button>
          <LogoutButton />
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <aside className="w-64 shrink-0 overflow-y-auto border-r p-3">
          <h3 className="mb-2 text-sm font-medium">
            {t('canvas.layersTitle')}
          </h3>
          <LayersPanel
            blocks={localBlocks}
            hoveredBlockId={bridge.hoveredBlockId}
            selectedBlockId={bridge.selectedBlockId}
            onReorderRoot={handleReorderRoot}
          />
          <h3 className="mb-2 mt-4 text-sm font-medium">
            {t('canvas.insertBlock')}
          </h3>
          <BlockPicker
            categories={categories}
            registry={registry}
            onInsert={handleInsert}
          />
        </aside>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <CanvasFrame
            pageId={pageId}
            editingSection={editingSection}
            iframeRef={iframeRef}
            bridge={bridge}
            dropIndicatorTop={liveDropTarget?.indicatorTop}
          />
        </div>
        <aside className="w-72 shrink-0 overflow-y-auto border-l p-3">
          {selectedBlock && selectedDescriptor ? (
            <>
              <button
                type="button"
                className="mb-2 text-xs text-destructive hover:underline"
                onClick={handleRemoveSelected}
              >
                {t('canvas.removeBlock')}
              </button>
              <InspectorPanel
                block={selectedBlock}
                descriptor={selectedDescriptor}
                onChangeProp={handleChangeProp}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('canvas.inspectorEmpty')}
            </p>
          )}
        </aside>
      </div>
      {children}
    </div>
  );
}
