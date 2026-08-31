import { Editor } from '@tiptap/core';
import TiptapDocument from '@tiptap/extension-document';
import TiptapParagraph from '@tiptap/extension-paragraph';
import TiptapText from '@tiptap/extension-text';
import {
  isPreviewBridgeMessage,
  PREVIEW_BRIDGE_SOURCE,
  PREVIEW_BRIDGE_VERSION,
  type PreviewToParentMessage,
} from '@brisk/shared-types';
import { runBlockBehaviorsInSubtree } from './block-behaviors/run-block-behaviors-in-subtree';
import {
  applyBlockInsert,
  applyBlockPatch,
  applyBlockRemove,
  applyBlockReorder,
  applyBlockStyleCss,
  blockIdOf,
  collectBlockElements,
  escapeHtml,
  findFieldElement,
  findFieldUnderPointer,
  findRealInteractiveAncestor,
  isBlockInteractive,
  isRootLevelBlock,
  parseEditingSection,
  scrollBlockIntoView,
  toBlockRects,
} from './preview-bridge-client';

function postToParent(
  targetOrigin: string,
  message: Omit<PreviewToParentMessage, 'source' | 'v'>,
): void {
  window.parent.postMessage(
    { source: PREVIEW_BRIDGE_SOURCE, v: PREVIEW_BRIDGE_VERSION, ...message },
    targetOrigin,
  );
}

/**
 * Montato solo dalle rotte di preview (PageLayout.astro, quando
 * editable=true) — mai sulla rotta pubblicata reale. `targetOrigin` viene da
 * `<body data-brisk-editor-app-url>` (impostato server-side dalla stessa env
 * var usata per l'header CSP frame-ancestors della rotta), mai da
 * `event.origin` in entrata: questo file per ora invia soltanto, non riceve
 * (i messaggi genitore -> iframe arrivano dal Giorno 3 in poi e dovranno
 * verificare `event.origin` a loro volta).
 *
 * L'orchestratore vero e proprio — i predicati/le funzioni pure di parsing e
 * patch DOM (usate anche qui) vivono in preview-bridge-client.ts, separate
 * apposta per essere testabili senza dover montare l'intero bridge (vedi
 * preview-bridge-client.spec.ts, che le testa una per una, contro
 * init-preview-bridge.spec.ts che testa invece questa funzione come
 * orchestratore/integrazione).
 */
export function initPreviewBridge(): void {
  const editorAppUrl = document.body.dataset['briskEditorAppUrl'];
  if (!editorAppUrl) {
    return;
  }
  // A fresh `const` with a plain `string` type, not a narrowed
  // `string | undefined` — TypeScript doesn't carry control-flow narrowing
  // into the nested function declarations below, even for a `const` that's
  // provably never reassigned.
  const targetOrigin: string = editorAppUrl;

  const editingSection = parseEditingSection(window.location.search);
  let lastHoveredId: string | null = null;
  let activeTextEditor: {
    editor: Editor;
    blockId: string;
    field: string;
    element: HTMLElement;
  } | null = null;

  // Stato del drag simulato lato genitore (Giorno 3/4) — vedi
  // PreviewDragStartMessage per il perché non è un vero drag HTML5.
  // `pendingDrag` copre la finestra tra mousedown e la soglia di movimento:
  // un click semplice (mousedown+mouseup senza muovere abbastanza) non deve
  // MAI diventare un drag, altrimenti la normale selezione via click si
  // romperebbe.
  const DRAG_START_THRESHOLD_PX = 4;
  let pendingDrag: { blockId: string; startX: number; startY: number } | null =
    null;
  let isDragging = false;
  let dragMoveRaf: number | null = null;
  let latestDragPointer: { x: number; y: number } | null = null;

  // Smonta l'istanza TipTap corrente, se c'è — su blur, Escape, o quando il
  // genitore chiede di entrare in editing di un altro field. Un solo field
  // alla volta è montato, mai due contemporaneamente. Il testo finale
  // digitato resta visibile (diventa di nuovo un nodo statico) — nessuna
  // patch a frammento serve per il testo, il DOM mostra già dal vivo
  // quello che l'editor ha digitato.
  function exitTextEdit(): void {
    if (!activeTextEditor) {
      return;
    }
    const { editor, element } = activeTextEditor;
    const finalText = editor.getText();
    editor.destroy();
    element.textContent = finalText;
    activeTextEditor = null;
  }

  // Monta TipTap "sul posto" sul nodo `data-brisk-field` — prende possesso
  // della sua reconciliazione, fix strutturale del bug del cursore di Puck
  // (Giorno 3/4 del piano): nessun re-render React guida più quel nodo.
  // Vincolato a Document/Paragraph/Text (un singolo paragrafo, niente
  // marks): ogni field inlineEditable è un `z.string()` semplice a livello
  // di dominio, mai HTML — vedi PreviewTextChangedMessage.
  function enterTextEdit(blockId: string, field: string): void {
    exitTextEdit();
    const element = findFieldElement(document, blockId, field);
    if (!element) {
      return;
    }
    // TipTap non sostituisce il contenuto esistente da solo — monta il
    // proprio DOM gestito da ProseMirror COME FIGLIO del nodo, accanto al
    // testo statico già renderizzato da Astro, se non viene svuotato
    // prima. Verificato dal vivo: senza questa riga il testo appariva
    // duplicato (statico + ProseMirror insieme).
    const initialText = element.textContent ?? '';
    element.innerHTML = '';
    const editor = new Editor({
      element,
      extensions: [TiptapDocument, TiptapParagraph, TiptapText],
      content: `<p>${escapeHtml(initialText)}</p>`,
      autofocus: 'end',
      onUpdate: ({ editor: current }) => {
        postToParent(targetOrigin, {
          type: 'preview:text-changed',
          payload: { blockId, field, text: current.getText() },
        });
      },
      onBlur: () => {
        exitTextEdit();
      },
    });
    activeTextEditor = { editor, blockId, field, element };
  }

  function sendReady(): void {
    postToParent(targetOrigin, {
      type: 'preview:ready',
      payload: {
        blockRects: toBlockRects(collectBlockElements(document)),
        scrollHeight: document.documentElement.scrollHeight,
      },
    });
  }

  function sendBlockRects(): void {
    postToParent(targetOrigin, {
      type: 'preview:block-rects',
      payload: { blockRects: toBlockRects(collectBlockElements(document)) },
    });
  }

  const resizeObserver = new ResizeObserver(sendBlockRects);
  for (const el of collectBlockElements(document)) {
    resizeObserver.observe(el);
  }
  window.addEventListener('resize', sendBlockRects);
  window.addEventListener('scroll', sendBlockRects, { passive: true });

  document.addEventListener(
    'mouseover',
    (event) => {
      const target = event.target as Element | null;
      const blockEl = target?.closest?.('[data-brisk-block-id]') ?? null;
      const id =
        blockEl && isBlockInteractive(blockEl, editingSection)
          ? blockIdOf(blockEl)
          : null;
      if (id === lastHoveredId) {
        return;
      }
      lastHoveredId = id;
      postToParent(targetOrigin, {
        type: 'preview:hover',
        payload: {
          blockId: id,
          pointer: { x: event.clientX, y: event.clientY },
        },
      });
    },
    true,
  );

  // Capture-phase, sempre attivo in edit mode: senza, il primo click su un
  // <a>/<button>/<form>/<details> reale navigherebbe via l'iframe,
  // uccidendo la sessione di editing — vedi il piano, Giorno 2.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      if (target && findRealInteractiveAncestor(target)) {
        event.preventDefault();
      }
      const blockEl = target?.closest?.('[data-brisk-block-id]') ?? null;
      const id = blockEl ? blockIdOf(blockEl) : null;
      if (id && blockEl && isBlockInteractive(blockEl, editingSection)) {
        postToParent(targetOrigin, {
          type: 'preview:click',
          payload: { blockId: id },
        });
      }
    },
    true,
  );
  document.addEventListener('submit', (event) => event.preventDefault(), true);

  // Trigger per entrare in editing testo inline (Giorno 4) — la navigazione
  // reale su un doppio click è già bloccata dall'handler `click` sopra
  // (ogni click che compone il doppio click passa comunque da lì).
  document.addEventListener(
    'dblclick',
    (event) => {
      const target = event.target as Element | null;
      const blockEl = target?.closest?.('[data-brisk-block-id]') ?? null;
      const id = blockEl ? blockIdOf(blockEl) : null;
      if (
        id &&
        blockEl &&
        target &&
        isBlockInteractive(blockEl, editingSection)
      ) {
        postToParent(targetOrigin, {
          type: 'preview:dblclick',
          payload: {
            blockId: id,
            field: findFieldUnderPointer(blockEl, target),
          },
        });
      }
    },
    true,
  );

  // Riordino diretto sul canvas (Giorno 3/4) — mousedown apre solo
  // un'INTENZIONE di drag (`pendingDrag`), mai un drag vero e proprio subito:
  // un mousedown+mouseup senza spostarsi abbastanza deve restare un click
  // normale (selezione), non un drag. Capture-phase, stessa ragione di
  // click/dblclick sopra.
  document.addEventListener(
    'mousedown',
    (event) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target as Element | null;
      const blockEl = target?.closest?.('[data-brisk-block-id]') ?? null;
      const id = blockEl ? blockIdOf(blockEl) : null;
      if (
        id &&
        blockEl &&
        isBlockInteractive(blockEl, editingSection) &&
        isRootLevelBlock(blockEl)
      ) {
        pendingDrag = {
          blockId: id,
          startX: event.clientX,
          startY: event.clientY,
        };
      }
    },
    true,
  );

  document.addEventListener(
    'mousemove',
    (event) => {
      if (!isDragging) {
        const drag = pendingDrag;
        if (!drag) {
          return;
        }
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) {
          return;
        }
        isDragging = true;
        // Impedisce la selezione di testo nativa mentre si trascina — un
        // vero drag HTML5 non serve (vedi sopra), ma il browser selezionerebbe
        // comunque il testo sotto il puntatore durante un mousemove tenuto
        // premuto se non intercettato qui.
        event.preventDefault();
        postToParent(targetOrigin, {
          type: 'preview:drag-start',
          payload: {
            blockId: drag.blockId,
            pointer: { x: event.clientX, y: event.clientY },
          },
        });
        return;
      }
      event.preventDefault();
      latestDragPointer = { x: event.clientX, y: event.clientY };
      // Throttled a un frame (stessa cura prestazionale del ResizeObserver
      // sopra) — un mousemove nativo può sparare molto più spesso di quanto
      // serva ridisegnare l'indicatore di drop lato genitore.
      if (dragMoveRaf === null) {
        dragMoveRaf = requestAnimationFrame(() => {
          dragMoveRaf = null;
          if (latestDragPointer) {
            postToParent(targetOrigin, {
              type: 'preview:drag-move',
              payload: { pointer: latestDragPointer },
            });
          }
        });
      }
    },
    true,
  );

  window.addEventListener('mouseup', () => {
    pendingDrag = null;
    if (isDragging) {
      isDragging = false;
      latestDragPointer = null;
      if (dragMoveRaf !== null) {
        cancelAnimationFrame(dragMoveRaf);
        dragMoveRaf = null;
      }
      postToParent(targetOrigin, { type: 'preview:drag-end', payload: {} });
    }
  });

  // Genitore -> iframe: editor:patch-block (Giorno 3), editor:enter/exit-text-edit
  // (Giorno 4). Stessa verifica dell'origine del lato genitore
  // (use-preview-bridge.ts) — un postMessage con l'envelope giusto ma da
  // un'origine diversa va ignorato.
  window.addEventListener('message', (event) => {
    if (event.origin !== targetOrigin) {
      return;
    }
    if (!isPreviewBridgeMessage(event.data)) {
      return;
    }
    switch (event.data.type) {
      case 'editor:patch-block': {
        const { blockId, html } = event.data.payload;
        const patched = applyBlockPatch(document, blockId, html);
        if (patched) {
          resizeObserver.observe(patched);
          runBlockBehaviorsInSubtree(patched);
        }
        sendBlockRects();
        return;
      }
      case 'editor:insert-block': {
        const { html, parentId, beforeBlockId } = event.data.payload;
        const inserted = applyBlockInsert(
          document,
          html,
          parentId,
          beforeBlockId,
          editingSection,
        );
        if (inserted) {
          resizeObserver.observe(inserted);
          runBlockBehaviorsInSubtree(inserted);
        }
        sendBlockRects();
        return;
      }
      case 'editor:remove-block': {
        applyBlockRemove(document, event.data.payload.blockId);
        sendBlockRects();
        return;
      }
      case 'editor:reorder-blocks': {
        const { parentId, orderedIds } = event.data.payload;
        applyBlockReorder(document, parentId, orderedIds, editingSection);
        sendBlockRects();
        return;
      }
      case 'editor:enter-text-edit': {
        const { blockId, field } = event.data.payload;
        enterTextEdit(blockId, field);
        return;
      }
      case 'editor:exit-text-edit':
        exitTextEdit();
        return;
      case 'editor:update-block-style-css':
        applyBlockStyleCss(document, event.data.payload.css);
        return;
      case 'editor:scroll-to-block':
        scrollBlockIntoView(document, event.data.payload.blockId);
        return;
      default:
        return;
    }
  });

  sendReady();
}
