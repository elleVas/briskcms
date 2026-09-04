/**
 * The postMessage protocol between the canvas (apps/editor-app, the parent)
 * and the real page rendered in the iframe (apps/public-site) — see the
 * visual editor plan, Day 2/3. Every message carries the same
 * `{ source, v, type, payload }` envelope; both sides check `event.origin`
 * before reading `event.data` (see use-preview-bridge.ts /
 * preview-bridge-client.ts).
 *
 */
export const PREVIEW_BRIDGE_SOURCE = 'brisk-preview-bridge' as const;
export const PREVIEW_BRIDGE_VERSION = 1 as const;

/** Always viewport-relative (the same semantics as `getBoundingClientRect()`), never document-relative — the parent combines them with its own `<iframe>`'s position to draw the overlay. */
export interface BlockRect {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PreviewBridgeEnvelope<Type extends string, Payload> {
  source: typeof PREVIEW_BRIDGE_SOURCE;
  v: typeof PREVIEW_BRIDGE_VERSION;
  type: Type;
  payload: Payload;
}

export type PreviewReadyMessage = PreviewBridgeEnvelope<
  'preview:ready',
  { blockRects: BlockRect[]; scrollHeight: number }
>;

/** Re-sent on every ResizeObserver/scroll/resize — never only at mount. */
export type PreviewBlockRectsMessage = PreviewBridgeEnvelope<
  'preview:block-rects',
  { blockRects: BlockRect[] }
>;

/** `blockId: null` quando il puntatore lascia ogni blocco tracciato (o un blocco fuori dallo scope editabile corrente, vedi editingSection). */
export type PreviewHoverMessage = PreviewBridgeEnvelope<
  'preview:hover',
  { blockId: string | null; pointer: { x: number; y: number } }
>;

/** Mai emesso per un blocco fuori dallo scope editabile corrente (vedi editingSection in preview-bridge-client.ts). */
export type PreviewClickMessage = PreviewBridgeEnvelope<
  'preview:click',
  { blockId: string }
>;

/**
 * Double click — the trigger for entering inline text editing (Day 4):
 * `field` is the nearest `data-brisk-field` value under the cursor, `null`
 * when the double click landed on the block but outside every
 * `inlineEditable` field (a padding area, say). Never emitted for a block
 * outside the current editable scope, the same rule as preview:click.
 */
export type PreviewDblClickMessage = PreviewBridgeEnvelope<
  'preview:dblclick',
  { blockId: string; field: string | null }
>;

/**
 * Keeps TipTap in sync with text typed live (Day 4), debounced on the
 * parent side before the draft is saved. `text`, not `html`: every
 * `inlineEditable` field in this codebase is a plain `z.string()` at the
 * domain level (title/subtitle/body/..., see content-model.ts) — never
 * HTML. TipTap is constrained here to a single paragraph with no marks (see
 * preview-bridge-client.ts), so `editor.getText()` is the correct read, not
 * `editor.getHTML()`: that second one would only apply to a field the
 * domain genuinely modelled as HTML, which none does today.
 */
export type PreviewTextChangedMessage = PreviewBridgeEnvelope<
  'preview:text-changed',
  { blockId: string; field: string; text: string }
>;

/**
 * The start of a drag simulated on the parent side (Day 3/4: direct
 * reordering on the canvas) — on `mousedown` on a block within the current
 * editable scope. The iframe never receives a real native drag event (HTML5
 * drag-and-drop does not cross the iframe boundary reliably across
 * browsers, see the visual editor plan): the parent owns the entire drag
 * state, and the iframe merely reports `mousedown`/`mousemove`/`mouseup` as
 * it already does for hover/click. The parent decides whether `blockId` is
 * genuinely reorderable (a top-level block — nested reordering stays a
 * separate TODO, the same choice layers-panel.tsx made) and ignores the
 * event otherwise, the same "an unknown blockId crashes nothing" principle
 * as use-block-tree.ts.
 */
export type PreviewDragStartMessage = PreviewBridgeEnvelope<
  'preview:drag-start',
  { blockId: string; pointer: { x: number; y: number } }
>;

/**
 * Re-sent on every `mousemove` while a drag is in progress (throttled to
 * one frame through requestAnimationFrame, the same performance care as the
 * ResizeObserver already in preview-bridge-client.ts) — it covers ONLY the
 * stretch where the pointer is over the iframe: while it is over the
 * parent's document, the parent already tracks it natively with its own
 * `mousemove`, so no bridging is needed for that stretch.
 */
export type PreviewDragMoveMessage = PreviewBridgeEnvelope<
  'preview:drag-move',
  { pointer: { x: number; y: number } }
>;

/** `mouseup` while a drag is in progress, wherever it lands — the parent computes the final drop position and applies it to its own `Block[]`; the iframe knows nothing of the outcome. */
export type PreviewDragEndMessage = PreviewBridgeEnvelope<
  'preview:drag-end',
  Record<string, never>
>;

export type PreviewToParentMessage =
  | PreviewReadyMessage
  | PreviewBlockRectsMessage
  | PreviewHoverMessage
  | PreviewClickMessage
  | PreviewDblClickMessage
  | PreviewTextChangedMessage
  | PreviewDragStartMessage
  | PreviewDragMoveMessage
  | PreviewDragEndMessage;

/**
 * Targeted replacement after render-block-fragment (Day 3): `html` already
 * carries its own `data-brisk-block-id`/`data-brisk-block-type` wrapper
 * (RenderSingleBlock.astro builds it with `editable` always true), and the
 * script in the iframe replaces the existing node through a targeted
 * `outerHTML` — no reload, no flash.
 */
export type EditorPatchBlockMessage = PreviewBridgeEnvelope<
  'editor:patch-block',
  { blockId: string; html: string }
>;

/**
 * Mounts TipTap "in place" (Day 4) on the `[data-brisk-field=field]` node
 * inside block `blockId` — TipTap takes ownership of the existing node and
 * handles its own reconciliation, which is a structural fix for Puck's
 * caret bug (no React re-render drives that node any more), not a
 * workaround.
 */
export type EditorEnterTextEditMessage = PreviewBridgeEnvelope<
  'editor:enter-text-edit',
  { blockId: string; field: string }
>;

/**
 * Blur/Escape, or another block selected while this one is being edited —
 * unmounts the current TipTap instance, if there is one. No payload: which
 * block/field is being edited has been entirely the iframe's business (see
 * `activeTextEditor` in preview-bridge-client.ts), and the parent only asks
 * "exit, whatever is active".
 */
export type EditorExitTextEditMessage = PreviewBridgeEnvelope<
  'editor:exit-text-edit',
  Record<string, never>
>;

/**
 * A block the iframe has NEVER seen before (insert/duplicate) — unlike
 * `editor:patch-block` (which replaces an existing node), this one has to
 * create a new node and insert it in the right place. `html` already
 * carries its own wrapper (the same RenderSingleBlock.astro as patch-block,
 * including the whole subtree when the block has children — a single
 * `container.renderToString` renders the nested ones too). `parentId: null`
 * = the page root; `beforeBlockId: null` = at the end of the list (root or
 * inside the parent) rather than before a specific sibling.
 */
export type EditorInsertBlockMessage = PreviewBridgeEnvelope<
  'editor:insert-block',
  { html: string; parentId: string | null; beforeBlockId: string | null }
>;

/** A deleted block (the toolbar's "Remove block") — the iframe removes the `[data-brisk-block-id=blockId]` node from its own DOM, with no reload. */
export type EditorRemoveBlockMessage = PreviewBridgeEnvelope<
  'editor:remove-block',
  { blockId: string }
>;

/**
 * A reorder that has been applied (a canvas drag, the move up/down arrows,
 * a drag in the Layers panel) — `orderedIds` is the complete, final list of
 * siblings at that point in the tree, in the desired order. The iframe only
 * re-appends the EXISTING nodes in that order (`appendChild` on a node
 * already in the DOM moves it rather than cloning it) — no new rendering,
 * since every block involved is already visible.
 */
export type EditorReorderBlocksMessage = PreviewBridgeEnvelope<
  'editor:reorder-blocks',
  { parentId: string | null; orderedIds: string[] }
>;

/**
 * A "component-level" override just saved from the "Style" button
 * (docs/adr/0022) — `css` is already the result of
 * `buildBlockStyleOverridesCss` on the parent side (which knows the whole
 * updated map after the mutation), and the iframe only writes that text
 * into a dedicated `<style>` in its own `<head>` (creating it if there is
 * none yet). Unlike `editor:patch-block`, this touches the whole document's
 * styling rather than one node: every already-visible instance of that type
 * updates in one go, with no iframe reload.
 */
export type EditorUpdateBlockStyleCssMessage = PreviewBridgeEnvelope<
  'editor:update-block-style-css',
  { css: string }
>;

/**
 * A block selected from the Layers panel (right-hand column) — unlike the
 * other parent -> iframe messages, this one does not change the DOM: it
 * only asks the iframe to bring block `blockId` into view, so the panel's
 * selection stays visible even on a long page with many blocks. A silent
 * no-op when the block is no longer in the DOM, the same discipline as
 * `editor:patch-block`/`editor:remove-block`.
 */
export type EditorScrollToBlockMessage = PreviewBridgeEnvelope<
  'editor:scroll-to-block',
  { blockId: string }
>;

export type ParentToPreviewMessage =
  | EditorPatchBlockMessage
  | EditorEnterTextEditMessage
  | EditorExitTextEditMessage
  | EditorRemoveBlockMessage
  | EditorReorderBlocksMessage
  | EditorInsertBlockMessage
  | EditorUpdateBlockStyleCssMessage
  | EditorScrollToBlockMessage;

export type AnyPreviewBridgeMessage =
  PreviewToParentMessage | ParentToPreviewMessage;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The type guard both sides use before trusting `event.data` — a third-party `postMessage` (browser extensions, other scripts on the same page) does not carry this envelope and is discarded silently rather than thrown on. */
export function isPreviewBridgeMessage(
  data: unknown,
): data is AnyPreviewBridgeMessage {
  return (
    isPlainObject(data) &&
    data['source'] === PREVIEW_BRIDGE_SOURCE &&
    data['v'] === PREVIEW_BRIDGE_VERSION &&
    typeof data['type'] === 'string'
  );
}
