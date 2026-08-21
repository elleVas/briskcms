import { Editor } from '@tiptap/core';
import TiptapDocument from '@tiptap/extension-document';
import TiptapParagraph from '@tiptap/extension-paragraph';
import TiptapText from '@tiptap/extension-text';
import {
  isPreviewBridgeMessage,
  PREVIEW_BRIDGE_SOURCE,
  PREVIEW_BRIDGE_VERSION,
  type BlockRect,
  type PreviewToParentMessage,
} from '@brisk/shared-types';
import { getBlockRect } from './get-block-rect.js';

export type EditingSection = 'header' | 'footer';

/**
 * `null` = si sta editando il contenuto della pagina — vedi il piano
 * dell'editor visuale, Giorno 1/2: la stessa rotta di preview pagina serve
 * anche per header/footer, distinta solo da questo query param.
 */
export function parseEditingSection(search: string): EditingSection | null {
  const value = new URLSearchParams(search).get('editingSection');
  return value === 'header' || value === 'footer' ? value : null;
}

/**
 * Un blocco è selezionabile/hoverabile solo nello scope attualmente in
 * editing: dentro `<header>` quando si edita l'header, dentro `<footer>`
 * quando si edita il footer, altrimenti (si sta editando la pagina) solo
 * fuori da entrambi. Il resto resta visibile per contesto ma inerte — mai
 * un `preview:hover`/`preview:click` per un blocco fuori scope.
 */
export function isBlockInteractive(
  blockEl: Element,
  editingSection: EditingSection | null,
): boolean {
  const insideHeader = blockEl.closest('header') !== null;
  const insideFooter = blockEl.closest('footer') !== null;
  if (editingSection === 'header') return insideHeader;
  if (editingSection === 'footer') return insideFooter;
  return !insideHeader && !insideFooter;
}

/** Ogni wrapper marcato da BlockRenderer.astro quando editable=true. */
export function collectBlockElements(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll('[data-brisk-block-id]'));
}

/**
 * Il vero elemento interattivo (link/bottone/form/dettaglio) più vicino, se
 * esiste — senza intercettarlo, il primo click su uno di questi navigherebbe
 * via l'iframe e ucciderebbe la sessione di editing (Puck non aveva questo
 * problema: canvas React portal-renderizzato, mai anchor veri).
 */
export function findRealInteractiveAncestor(target: Element): Element | null {
  return target.closest('a, button, details');
}

function blockIdOf(el: Element): string | null {
  return (el as HTMLElement).dataset['briskBlockId'] ?? null;
}

/**
 * Vero solo se NESSUN antenato del blocco è a sua volta un wrapper di
 * blocco — riordino diretto sul canvas (Giorno 3/4) è scoped ai blocchi di
 * primo livello, stessa scelta di layers-panel.tsx ("il riordino tra
 * fratelli annidati... resta un TODO separato"). Si parte da `parentElement`,
 * non da `blockEl` stesso, altrimenti `closest` troverebbe sempre almeno
 * `blockEl`.
 */
export function isRootLevelBlock(blockEl: Element): boolean {
  return blockEl.parentElement?.closest('[data-brisk-block-id]') == null;
}

/** Il valore di `data-brisk-field` più vicino sotto un punto del click, entro i confini del blocco — `null` se il doppio click è caduto sul blocco ma fuori da ogni campo `inlineEditable` (es. un'area di padding). */
export function findFieldUnderPointer(
  blockEl: Element,
  target: Element,
): string | null {
  const fieldEl = target.closest('[data-brisk-field]');
  if (!fieldEl || !blockEl.contains(fieldEl)) {
    return null;
  }
  return (fieldEl as HTMLElement).dataset['briskField'] ?? null;
}

export function toBlockRects(elements: Element[]): BlockRect[] {
  return elements.flatMap((el) => {
    const id = blockIdOf(el);
    if (!id) return [];
    return [{ id, ...getBlockRect(el) }];
  });
}

/**
 * Sostituzione mirata dopo render-block-fragment (Giorno 3) — `html` porta
 * già il proprio wrapper `data-brisk-block-id` (RenderSingleBlock.astro lo
 * costruisce con lo stesso id), quindi `outerHTML` rimpiazza esattamente il
 * nodo giusto. Restituisce il nuovo elemento (per ri-osservarlo col
 * ResizeObserver) o `null` se il blocco non è (più) nel documento — es. è
 * stato rimosso nel frattempo da un'altra azione, non un errore da segnalare.
 */
export function applyBlockPatch(
  root: ParentNode,
  blockId: string,
  html: string,
): Element | null {
  const target = root.querySelector(`[data-brisk-block-id="${blockId}"]`);
  if (!target) {
    return null;
  }
  target.outerHTML = html;
  return root.querySelector(`[data-brisk-block-id="${blockId}"]`);
}

/**
 * Inserisce un blocco MAI visto prima dell'iframe (inserimento/duplicazione)
 * — vedi EditorInsertBlockMessage. Trova il contenitore DOM giusto senza
 * bisogno di conoscere la struttura interna di ogni tipo di blocco-
 * contenitore (Container/Columns/Accordion/...): se esiste già un fratello
 * (`beforeBlockId`), il SUO `parentElement` è per costruzione il contenitore
 * giusto (ogni blocco è un wrapper `display:contents` piazzato direttamente
 * come figlio di quel contenitore, mai avvolto in altro — vedi
 * BlockRenderer.astro). Altrimenti (contenitore vuoto, o radice) serve un
 * riferimento esplicito: il primo figlio del wrapper del blocco-contenitore
 * (ogni blocco-contenitore renderizza `<slot/>` come unico contenuto del
 * proprio elemento radice) per un inserimento annidato, o il marcatore
 * `data-brisk-root-blocks="page"/"header"/"footer"` (PublicPageContent.astro/
 * PageLayout.astro) per la radice, distinto per scope perché le tre liste
 * radice possono coesistere sulla stessa pagina.
 */
export function applyBlockInsert(
  root: ParentNode,
  html: string,
  parentId: string | null,
  beforeBlockId: string | null,
  editingSection: EditingSection | null,
): Element | null {
  const beforeEl = beforeBlockId
    ? root.querySelector(`[data-brisk-block-id="${beforeBlockId}"]`)
    : null;

  const container = beforeEl?.parentElement
    ? beforeEl.parentElement
    : parentId
      ? (root.querySelector(`[data-brisk-block-id="${parentId}"]`)
          ?.firstElementChild ?? null)
      : root.querySelector(
          `[data-brisk-root-blocks="${editingSection ?? 'page'}"]`,
        );
  if (!container) {
    return null;
  }

  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const newNode = template.content.firstElementChild;
  if (!newNode) {
    return null;
  }

  if (beforeEl) {
    container.insertBefore(newNode, beforeEl);
  } else {
    container.appendChild(newNode);
  }
  return newNode;
}

/** Il nodo esatto di un field `inlineEditable` dentro un blocco — marcato a mano nel componente Astro del blocco (vedi Hero.astro). `null` se il blocco o il field non esistono (mai un errore da segnalare: un blockId/field ormai stale, es. dopo una patch a frammento, è un caso normale). */
export function findFieldElement(
  root: ParentNode,
  blockId: string,
  field: string,
): HTMLElement | null {
  const blockEl = root.querySelector(`[data-brisk-block-id="${blockId}"]`);
  if (!blockEl) {
    return null;
  }
  return blockEl.querySelector(`[data-brisk-field="${field}"]`);
}

/** TipTap analizza `content` come HTML — un titolo che contenga `&`/`<`/`>` va escaped prima, altrimenti verrebbe interpretato come markup invece che testo letterale. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

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
        }
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
      default:
        return;
    }
  });

  sendReady();
}
