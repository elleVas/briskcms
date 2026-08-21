import { useCallback, useEffect, useState, type RefObject } from 'react';
import {
  isPreviewBridgeMessage,
  PREVIEW_BRIDGE_SOURCE,
  PREVIEW_BRIDGE_VERSION,
  type BlockRect,
} from '@brisk/shared-types';

export interface PreviewBridgeState {
  /** Vuoto finché `preview:ready` non arriva la prima volta. */
  blockRects: BlockRect[];
  isReady: boolean;
  hoveredBlockId: string | null;
  /** Sola-lettura per ora (Giorno 2): nessuno stato persistito altrove, solo un riscontro visivo nell'overlay/Layers. */
  selectedBlockId: string | null;
  /**
   * L'ultimo doppio click ricevuto (Giorno 4) — un OGGETTO NUOVO ad ogni
   * messaggio (anche se blockId/field sono identici al precedente), così un
   * `useEffect` del chiamante keyed su questo valore si attiva ad ogni
   * singolo doppio click per riferimento, non per uguaglianza di contenuto.
   * Esposto come stato, non come callback: decidere se il field è
   * `inlineEditable` richiede il block-registry, che questo hook (bridge
   * postMessage generico) non conosce — quella policy vive nel chiamante
   * (canvas-editor-shell.tsx), non qui.
   */
  lastDblClick: { blockId: string; field: string | null } | null;
  /**
   * L'ultimo testo digitato dal vivo in un'istanza TipTap montata sul posto
   * (Giorno 4) — stessa ragione di `lastDblClick`: un oggetto nuovo ad ogni
   * messaggio, così un `useEffect` del chiamante si attiva ad ogni singolo
   * cambiamento anche quando blockId/field sono ripetuti.
   */
  lastTextChange: { blockId: string; field: string; text: string } | null;
  /**
   * Non-null durante un drag simulato in corso (riordino diretto sul canvas,
   * Giorno 3/4) — `pointer` è iframe-relative (stessa semantica di
   * `BlockRect`, il chiamante la combina con l'offset dell'iframe per
   * disegnare l'indicatore di drop, come già fa OverlayLayer per
   * hover/selezione).
   */
  activeDrag: { blockId: string; pointer: { x: number; y: number } } | null;
  /**
   * Un oggetto nuovo ad ogni `preview:drag-end` (stessa ragione di
   * `lastDblClick`) — porta l'ultimo blockId/pointer noto del drag appena
   * concluso, così il chiamante può calcolare la posizione di drop finale
   * e applicarla al proprio `Block[]`. `activeDrag` torna `null` nello
   * stesso aggiornamento di stato (il drag è visivamente finito).
   */
  dragEnded: { blockId: string; pointer: { x: number; y: number } } | null;
  /** Sostituisce un blocco già renderizzato con l'HTML del frammento ottenuto da render-block-fragment (Giorno 3) — vedi block-fragment-api-client.ts. */
  patchBlock: (blockId: string, html: string) => void;
  /** Inserisce un blocco MAI renderizzato prima (inserimento/duplicazione) — vedi EditorInsertBlockMessage. */
  insertBlock: (
    html: string,
    parentId: string | null,
    beforeBlockId: string | null,
  ) => void;
  /** Rimuove un blocco già renderizzato dal DOM dell'iframe — vedi EditorRemoveBlockMessage. */
  removeBlock: (blockId: string) => void;
  /** Riordina i fratelli esistenti (già tutti renderizzati) — vedi EditorReorderBlocksMessage. */
  reorderBlocks: (parentId: string | null, orderedIds: string[]) => void;
  /** Monta TipTap sul posto nell'iframe (Giorno 4) — vedi editor:enter-text-edit. */
  enterTextEdit: (blockId: string, field: string) => void;
  /** Smonta l'istanza TipTap corrente nell'iframe, se c'è. */
  exitTextEdit: () => void;
}

type PreviewBridgeMessageState = Omit<
  PreviewBridgeState,
  | 'patchBlock'
  | 'insertBlock'
  | 'removeBlock'
  | 'reorderBlocks'
  | 'enterTextEdit'
  | 'exitTextEdit'
>;

const initialState: PreviewBridgeMessageState = {
  blockRects: [],
  isReady: false,
  hoveredBlockId: null,
  selectedBlockId: null,
  lastDblClick: null,
  lastTextChange: null,
  activeDrag: null,
  dragEnded: null,
};

/**
 * Lato genitore del protocollo postMessage (vedi
 * @brisk/shared-types/preview-bridge-protocol.ts e il piano dell'editor
 * visuale, Giorno 2) — ascolta `preview:*` da un iframe specifico, mai da
 * qualunque iframe: sia `event.origin` che `event.source` sono verificati,
 * così un altro iframe/estensione che spedisse lo stesso envelope non verrebbe
 * mai considerato.
 *
 * Ogni evento in arrivo è esposto come STATO (mai un callback prop): un
 * callback passato dal chiamante avrebbe un'identità nuova ad ogni suo
 * render, e farla dipendere da altri valori derivati da hook del chiamante
 * stesso (es. `usePropertyPatch`, che a sua volta ha bisogno di
 * `patchBlock` restituito da QUESTO hook) creerebbe un ciclo tra due
 * chiamate di hook — niente di simile con lo stato: il chiamante reagisce
 * con un proprio `useEffect` keyed sul valore, letto quando gli serve.
 */
export function usePreviewBridge(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  expectedOrigin: string,
): PreviewBridgeState {
  const [state, setState] = useState<PreviewBridgeMessageState>(initialState);

  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      if (event.origin !== expectedOrigin) {
        return;
      }
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (!isPreviewBridgeMessage(event.data)) {
        return;
      }

      const message = event.data;
      switch (message.type) {
        case 'preview:ready':
          setState((prev) => ({
            ...prev,
            isReady: true,
            blockRects: message.payload.blockRects,
          }));
          return;
        case 'preview:block-rects':
          setState((prev) => ({
            ...prev,
            blockRects: message.payload.blockRects,
          }));
          return;
        case 'preview:hover':
          setState((prev) => ({
            ...prev,
            hoveredBlockId: message.payload.blockId,
          }));
          return;
        case 'preview:click':
          setState((prev) => ({
            ...prev,
            selectedBlockId: message.payload.blockId,
          }));
          return;
        case 'preview:dblclick':
          setState((prev) => ({
            ...prev,
            lastDblClick: {
              blockId: message.payload.blockId,
              field: message.payload.field,
            },
          }));
          return;
        case 'preview:text-changed':
          setState((prev) => ({
            ...prev,
            lastTextChange: {
              blockId: message.payload.blockId,
              field: message.payload.field,
              text: message.payload.text,
            },
          }));
          return;
        case 'preview:drag-start':
          setState((prev) => ({
            ...prev,
            activeDrag: {
              blockId: message.payload.blockId,
              pointer: message.payload.pointer,
            },
          }));
          return;
        case 'preview:drag-move':
          setState((prev) =>
            prev.activeDrag
              ? {
                  ...prev,
                  activeDrag: {
                    ...prev.activeDrag,
                    pointer: message.payload.pointer,
                  },
                }
              : prev,
          );
          return;
        case 'preview:drag-end':
          setState((prev) => ({
            ...prev,
            activeDrag: null,
            dragEnded: prev.activeDrag,
          }));
          return;
        case 'editor:patch-block':
        case 'editor:enter-text-edit':
        case 'editor:exit-text-edit':
        case 'editor:insert-block':
        case 'editor:remove-block':
        case 'editor:reorder-blocks':
          // Genitore -> iframe: mai attesi in arrivo qui, il genitore è chi
          // li invia (vedi patchBlock/enterTextEdit/exitTextEdit sotto).
          // Ignorati difensivamente.
          return;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeRef, expectedOrigin]);

  const patchBlock = useCallback(
    (blockId: string, html: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:patch-block',
          payload: { blockId, html },
        },
        expectedOrigin,
      );
    },
    [iframeRef, expectedOrigin],
  );

  const insertBlock = useCallback(
    (html: string, parentId: string | null, beforeBlockId: string | null) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:insert-block',
          payload: { html, parentId, beforeBlockId },
        },
        expectedOrigin,
      );
    },
    [iframeRef, expectedOrigin],
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:remove-block',
          payload: { blockId },
        },
        expectedOrigin,
      );
    },
    [iframeRef, expectedOrigin],
  );

  const reorderBlocks = useCallback(
    (parentId: string | null, orderedIds: string[]) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:reorder-blocks',
          payload: { parentId, orderedIds },
        },
        expectedOrigin,
      );
    },
    [iframeRef, expectedOrigin],
  );

  const enterTextEdit = useCallback(
    (blockId: string, field: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:enter-text-edit',
          payload: { blockId, field },
        },
        expectedOrigin,
      );
    },
    [iframeRef, expectedOrigin],
  );

  const exitTextEdit = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'editor:exit-text-edit',
        payload: {},
      },
      expectedOrigin,
    );
  }, [iframeRef, expectedOrigin]);

  return {
    ...state,
    patchBlock,
    insertBlock,
    removeBlock,
    reorderBlocks,
    enterTextEdit,
    exitTextEdit,
  };
}
