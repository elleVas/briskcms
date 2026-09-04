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
 * Mounted only by the preview routes (PageLayout.astro, when editable=true)
 * — never on the real published route. `targetOrigin` comes from
 * `<body data-brisk-editor-app-url>` (set server-side from the same env var
 * used for the route's CSP frame-ancestors header), never from an incoming
 * `event.origin`: this file only sends for now, it does not receive (parent
 * -> iframe messages arrive from Day 3 onwards and will have to check
 * `event.origin` themselves).
 *
 * The orchestrator proper — the predicates and the pure parsing/DOM-patching
 * functions (used here too) live in preview-bridge-client.ts, kept separate
 * so they can be tested without mounting the whole bridge (see
 * preview-bridge-client.spec.ts, which tests them one by one, against
 * init-preview-bridge.spec.ts, which tests this function as an
 * orchestrator/integration instead).
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

  // The state of the drag simulated on the parent side (Day 3/4) — see
  // PreviewDragStartMessage for why it is not a real HTML5 drag.
  // `pendingDrag` covers the window between mousedown and the movement
  // threshold: a plain click (mousedown+mouseup without moving far enough)
  // must NEVER become a drag, or ordinary click selection would break.
  const DRAG_START_THRESHOLD_PX = 4;
  let pendingDrag: { blockId: string; startX: number; startY: number } | null =
    null;
  let isDragging = false;
  let dragMoveRaf: number | null = null;
  let latestDragPointer: { x: number; y: number } | null = null;

  // Unmounts the current TipTap instance, if there is one — on blur, on
  // Escape, or when the parent asks to start editing another field. Only
  // one field is mounted at a time, never two at once. The final text typed
  // stays visible (it becomes a static node again) — no fragment patch is
  // needed for text, the DOM already shows live what the editor typed.
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

  // Mounts TipTap "in place" on the `data-brisk-field` node — it takes
  // ownership of that node's reconciliation, a structural fix for Puck's
  // caret bug (Day 3/4 of the plan): no React re-render drives that node any
  // more. Constrained to Document/Paragraph/Text (a single paragraph, no
  // marks): every inlineEditable field is a plain `z.string()` at the domain
  // level, never HTML — see PreviewTextChangedMessage.
  function enterTextEdit(blockId: string, field: string): void {
    exitTextEdit();
    const element = findFieldElement(document, blockId, field);
    if (!element) {
      return;
    }
    // TipTap does not replace the existing content by itself — it mounts
    // its own ProseMirror-managed DOM AS A CHILD of the node, next to the
    // static text Astro already rendered, unless that is emptied first.
    // Verified live: without this line the text appeared duplicated (static
    // plus ProseMirror together).
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

  // Capture-phase, always on in edit mode: without it, the first click on a
  // real <a>/<button>/<form>/<details> would navigate the iframe away,
  // killing the editing session — see the plan, Day 2.
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

  // The trigger for entering inline text editing (Day 4) — real navigation
  // on a double click is already blocked by the `click` handler above (each
  // click making up the double click still goes through it).
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

  // Direct reordering on the canvas (Day 3/4) — mousedown only opens an
  // INTENT to drag (`pendingDrag`), never a real drag straight away: a
  // mousedown+mouseup without moving far enough has to stay an ordinary
  // click (selection), not a drag. Capture-phase, for the same reason as
  // click/dblclick above.
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
        // Prevents native text selection while dragging — a real HTML5 drag
        // is not needed (see above), but the browser would still select the
        // text under the pointer during a held-down mousemove if it were not
        // intercepted here.
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

  // Parent -> iframe: editor:patch-block (Day 3), editor:enter/exit-text-edit
  // (Day 4). The same origin check as the parent side
  // (use-preview-bridge.ts) — a postMessage with the right envelope but from
  // a different origin is ignored.
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
