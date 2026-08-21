/**
 * Protocollo postMessage tra il canvas (apps/editor-app, genitore) e la
 * pagina reale renderizzata nell'iframe (apps/public-site) — vedi il piano
 * dell'editor visuale, Giorno 2/3. Ogni messaggio porta lo stesso envelope
 * `{ source, v, type, payload }`; entrambi i lati controllano `event.origin`
 * prima di leggere `event.data` (vedi use-preview-bridge.ts /
 * preview-bridge-client.ts).
 *
 */
export const PREVIEW_BRIDGE_SOURCE = 'brisk-preview-bridge' as const;
export const PREVIEW_BRIDGE_VERSION = 1 as const;

/** Sempre viewport-relative (stessa semantica di `getBoundingClientRect()`), mai document-relative — il genitore le combina con la posizione del proprio `<iframe>` per disegnare l'overlay. */
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

/** Ri-inviato ad ogni ResizeObserver/scroll/resize — mai solo al mount. */
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
 * Doppio click — trigger per entrare in editing testo inline (Giorno 4):
 * `field` è il valore di `data-brisk-field` più vicino sotto il cursore,
 * `null` se il doppio click è caduto sul blocco ma fuori da ogni campo
 * `inlineEditable` (es. un'area di padding). Mai emesso per un blocco fuori
 * dallo scope editabile corrente, stessa regola di preview:click.
 */
export type PreviewDblClickMessage = PreviewBridgeEnvelope<
  'preview:dblclick',
  { blockId: string; field: string | null }
>;

/**
 * Sincronizza TipTap col testo digitato dal vivo (Giorno 4), con debounce
 * lato genitore prima del salvataggio bozza. `text`, non `html`: ogni field
 * `inlineEditable` di questa codebase è un `z.string()` semplice a livello
 * di dominio (title/subtitle/body/..., vedi content-model.ts) — mai HTML.
 * TipTap qui è vincolato a un singolo paragrafo senza marks (vedi
 * preview-bridge-client.ts), quindi `editor.getText()` è la lettura
 * corretta, non `editor.getHTML()`: quel secondo varrebbe solo per un
 * field che il dominio modellasse davvero come HTML, che oggi non esiste.
 */
export type PreviewTextChangedMessage = PreviewBridgeEnvelope<
  'preview:text-changed',
  { blockId: string; field: string; text: string }
>;

/**
 * Inizio di un drag simulato lato genitore (Giorno 3/4: riordino diretto sul
 * canvas) — su `mousedown` su un blocco nello scope editabile corrente.
 * L'iframe non riceve mai un vero evento di drag nativo (HTML5 drag-and-drop
 * non attraversa il confine dell'iframe in modo affidabile multi-browser,
 * vedi il piano dell'editor visuale): il genitore possiede l'intero stato
 * del drag, l'iframe si limita a riportare `mousedown`/`mousemove`/`mouseup`
 * come fa già per hover/click. Il genitore decide se `blockId` è davvero
 * riordinabile (un blocco di primo livello — il riordino annidato resta un
 * TODO separato, stessa scelta di layers-panel.tsx) e ignora l'evento
 * altrimenti, stesso principio "un blockId ignoto non fa crashare nulla" di
 * use-block-tree.ts.
 */
export type PreviewDragStartMessage = PreviewBridgeEnvelope<
  'preview:drag-start',
  { blockId: string; pointer: { x: number; y: number } }
>;

/**
 * Ri-inviato ad ogni `mousemove` mentre un drag è in corso (throttled a un
 * frame via requestAnimationFrame, stessa cura prestazionale del
 * ResizeObserver già in preview-bridge-client.ts) — copre SOLO il tratto in
 * cui il puntatore è sopra l'iframe: mentre è sopra il documento del
 * genitore, il genitore lo traccia già nativamente col proprio
 * `mousemove`, nessun bridge necessario per quel tratto.
 */
export type PreviewDragMoveMessage = PreviewBridgeEnvelope<
  'preview:drag-move',
  { pointer: { x: number; y: number } }
>;

/** `mouseup` mentre un drag è in corso, ovunque cada — il genitore calcola la posizione di drop finale e la applica al proprio `Block[]`, l'iframe non sa nulla dell'esito. */
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
 * Sostituzione mirata dopo render-block-fragment (Giorno 3): `html` porta
 * già il proprio wrapper `data-brisk-block-id`/`data-brisk-block-type`
 * (RenderSingleBlock.astro lo costruisce con `editable` sempre true), lo
 * script nell'iframe sostituisce il nodo esistente via `outerHTML` mirato
 * — nessun reload, nessun flash.
 */
export type EditorPatchBlockMessage = PreviewBridgeEnvelope<
  'editor:patch-block',
  { blockId: string; html: string }
>;

/**
 * Monta TipTap "sul posto" (Giorno 4) sul nodo `[data-brisk-field=field]`
 * dentro il blocco `blockId` — TipTap prende possesso del nodo esistente e
 * gestisce la propria riconciliazione, fix strutturale del bug del cursore
 * di Puck (nessun re-render React guida più quel nodo), non un workaround.
 */
export type EditorEnterTextEditMessage = PreviewBridgeEnvelope<
  'editor:enter-text-edit',
  { blockId: string; field: string }
>;

/**
 * Blur/Escape, o un altro blocco selezionato mentre questo è in editing —
 * smonta l'istanza TipTap corrente, se ce n'è una. Nessun payload: quale
 * blocco/field sia in editing è stato interamente dell'iframe (vedi
 * `activeTextEditor` in preview-bridge-client.ts), il genitore chiede solo
 * "esci, qualunque cosa sia attiva".
 */
export type EditorExitTextEditMessage = PreviewBridgeEnvelope<
  'editor:exit-text-edit',
  Record<string, never>
>;

/**
 * Un blocco MAI visto prima dall'iframe (inserimento/duplicazione) — a
 * differenza di `editor:patch-block` (sostituisce un nodo esistente), qui
 * serve creare un nodo nuovo e inserirlo nel punto giusto. `html` porta già
 * il proprio wrapper (stesso RenderSingleBlock.astro di patch-block,
 * includendo l'intero sottoalbero se il blocco ha figli — un solo
 * `container.renderToString` rende anche i nested). `parentId: null` =
 * radice della pagina; `beforeBlockId: null` = in coda alla lista
 * (radice o dentro il genitore) invece che prima di un fratello preciso.
 */
export type EditorInsertBlockMessage = PreviewBridgeEnvelope<
  'editor:insert-block',
  { html: string; parentId: string | null; beforeBlockId: string | null }
>;

/** Un blocco eliminato (toolbar "Rimuovi blocco") — l'iframe rimuove il nodo `[data-brisk-block-id=blockId]` dal proprio DOM, nessun reload. */
export type EditorRemoveBlockMessage = PreviewBridgeEnvelope<
  'editor:remove-block',
  { blockId: string }
>;

/**
 * Un riordino applicato (drag sul canvas, frecce sposta su/giù, drag nel
 * pannello Livelli) — `orderedIds` è l'elenco completo e finale dei
 * fratelli in quel punto dell'albero, nello stesso ordine desiderato.
 * L'iframe si limita a ri-appendere i nodi ESISTENTI in quell'ordine
 * (`appendChild` su un nodo già nel DOM lo sposta, non lo clona) — nessun
 * nuovo rendering, i blocchi coinvolti sono già tutti visibili.
 */
export type EditorReorderBlocksMessage = PreviewBridgeEnvelope<
  'editor:reorder-blocks',
  { parentId: string | null; orderedIds: string[] }
>;

export type ParentToPreviewMessage =
  | EditorPatchBlockMessage
  | EditorEnterTextEditMessage
  | EditorExitTextEditMessage
  | EditorRemoveBlockMessage
  | EditorReorderBlocksMessage
  | EditorInsertBlockMessage;

export type AnyPreviewBridgeMessage =
  PreviewToParentMessage | ParentToPreviewMessage;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Type guard usato da entrambi i lati prima di fidarsi di `event.data` — un `postMessage` di terze parti (estensioni browser, altri script nella stessa pagina) non porta questo envelope e va scartato in silenzio, non lanciato. */
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
