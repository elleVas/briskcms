import { type BlockRect } from '@brisk/shared-types';
import { getBlockRect } from './get-block-rect';

/**
 * Funzioni pure di parsing/predicati e di patch DOM — deliberatamente
 * separate dall'orchestratore vero e proprio (`initPreviewBridge`, in
 * init-preview-bridge.ts) proprio per essere testabili una per una senza
 * dover montare l'intero bridge (vedi preview-bridge-client.spec.ts contro
 * init-preview-bridge.spec.ts). Nessuno stato a livello di modulo qui —
 * ogni funzione prende esplicitamente il proprio `root`/`blockId`/ecc.
 */

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

export function blockIdOf(el: Element): string | null {
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

  // Il wrapper vero non è per forza il primo figlio del frammento: alcuni
  // blocchi (Countdown, Form, MapEmbed...) hanno il proprio <script>
  // renderizzato come fratello del wrapper — RenderSingleBlock non ha una
  // pagina condivisa a cui "agganciarlo", diversamente da un render intero.
  const newNode = template.content.querySelector('[data-brisk-block-id]');
  if (!newNode) {
    return null;
  }

  // Uno <script> spostato qui via innerHTML/<template> è marcato "already
  // started" dallo spec e non esegue MAI da solo, nemmeno una volta
  // ricollegato al documento — va ricreato da zero (stesso motivo per cui
  // Countdown/Stat/ImageSlider/Tabs/Testimonials/BeforeAfter/Form/MapEmbed
  // restavano vuoti finché non si ricaricava la pagina; per Form/
  // NewsletterSignup questo fa ripartire anche lo <script src> di Turnstile,
  // che si auto-renderizza su ogni .cf-turnstile trovato). Sostituito in
  // loco, prima di spostare qualunque nodo: se annidato dentro newNode si
  // ricollega da solo quando newNode entra nel documento (l'intero sotto-
  // albero si connette in un colpo solo, prima che parta qualunque script
  // al suo interno); se è un fratello di newNode resta comunque dentro
  // `template.content` e va spostato a parte, subito dopo.
  for (const oldScript of Array.from(
    template.content.querySelectorAll('script'),
  )) {
    const freshScript = document.createElement('script');
    for (const { name, value } of Array.from(oldScript.attributes)) {
      freshScript.setAttribute(name, value);
    }
    freshScript.textContent = oldScript.textContent;
    oldScript.replaceWith(freshScript);
  }

  if (beforeEl) {
    container.insertBefore(newNode, beforeEl);
  } else {
    container.appendChild(newNode);
  }

  // Ogni nodo fratello rimasto in `template.content` (tipicamente lo
  // <script> ricreato sopra, se il fratello e non annidato) va riattaccato
  // subito dopo newNode, nello stesso ordine relativo dell'HTML originale.
  let anchor: ChildNode = newNode;
  for (const sibling of Array.from(template.content.childNodes)) {
    anchor.after(sibling);
    anchor = sibling;
  }

  return newNode;
}

/**
 * id fisso del `<style>` iniettato per l'override "a livello di
 * componente" (docs/adr/0022) — un solo elemento, riscritto per intero ad
 * ogni salvataggio dal pulsante "Stile" (il genitore manda già l'intera
 * mappa aggiornata di `blockStyles`, non un delta), mai accumulato.
 */
const BLOCK_STYLE_CSS_ELEMENT_ID = 'brisk-block-style-overrides';

/** Scrive/sostituisce il `<style>` degli override per-tipo (docs/adr/0022) — vedi EditorUpdateBlockStyleCssMessage. Crea l'elemento se non esiste ancora (primo salvataggio della sessione), lo riusa altrimenti. */
export function applyBlockStyleCss(root: Document, css: string): void {
  let styleEl = root.getElementById(BLOCK_STYLE_CSS_ELEMENT_ID);
  if (!styleEl) {
    styleEl = root.createElement('style');
    styleEl.id = BLOCK_STYLE_CSS_ELEMENT_ID;
    root.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

/** Rimuove un blocco eliminato dal DOM dell'iframe — `true` se un nodo è stato davvero rimosso, `false` se non era (più) presente (non un errore: un'azione precedente potrebbe già averlo tolto). */
export function applyBlockRemove(root: ParentNode, blockId: string): boolean {
  const target = root.querySelector(`[data-brisk-block-id="${blockId}"]`);
  if (!target) {
    return false;
  }
  target.remove();
  return true;
}

/**
 * Riordina i fratelli ESISTENTI (già tutti renderizzati) secondo
 * `orderedIds` — vedi EditorReorderBlocksMessage. Il contenitore è trovato
 * tramite il PRIMO fratello ancora presente nel DOM (il suo
 * `parentElement`, stessa euristica di `applyBlockInsert`): non serve
 * conoscere la struttura interna del blocco-contenitore. Un id in
 * `orderedIds` che non esiste (più) nel DOM viene ignorato in silenzio —
 * non tutti i fratelli devono necessariamente esistere ancora (una
 * rimozione appena applicata potrebbe non essere ancora rispecchiata nella
 * lista che il chiamante ha costruito).
 */
export function applyBlockReorder(
  root: ParentNode,
  parentId: string | null,
  orderedIds: string[],
  editingSection: EditingSection | null,
): void {
  const existing = orderedIds
    .map((id) => root.querySelector(`[data-brisk-block-id="${id}"]`))
    .filter((el): el is Element => el !== null);
  if (existing.length === 0) {
    return;
  }

  const container = existing[0].parentElement
    ? existing[0].parentElement
    : parentId
      ? (root.querySelector(`[data-brisk-block-id="${parentId}"]`)
          ?.firstElementChild ?? null)
      : root.querySelector(
          `[data-brisk-root-blocks="${editingSection ?? 'page'}"]`,
        );
  if (!container) {
    return;
  }

  // `appendChild` su un nodo già nel DOM lo SPOSTA (niente clone) — ri-
  // appenderli in sequenza desiderata li lascia in quell'ordine finale.
  for (const el of existing) {
    container.appendChild(el);
  }
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

/**
 * Porta in vista il blocco `blockId` (pannello Livelli, colonna destra) —
 * `true` se il blocco è stato trovato e lo scroll è partito, `false` se non
 * è (più) nel DOM (es. appena rimosso da un'altra azione): stesso caso
 * "non un errore da segnalare" di `applyBlockPatch`/`applyBlockRemove`.
 *
 * NON un semplice `target.scrollIntoView()`: `target` è il wrapper
 * `display:contents` di BlockRenderer.astro (vedi get-block-rect.ts),
 * quindi non ha mai un box proprio — `scrollIntoView()` su un elemento del
 * genere è un no-op nella maggior parte dei browser (bug live-verificato:
 * il click sul pannello Livelli selezionava il blocco ma il canvas non si
 * muoveva mai). `getBlockRect` misura invece il contenuto renderizzato via
 * `Range` (funziona identicamente per un elemento normale), poi lo
 * scroll è calcolato a mano per centrarlo in verticale — stessa semantica
 * di `scrollIntoView({block:'center'})` su un elemento con un box vero.
 */
export function scrollBlockIntoView(
  root: ParentNode,
  blockId: string,
): boolean {
  const target = root.querySelector(`[data-brisk-block-id="${blockId}"]`);
  if (!target) {
    return false;
  }
  const rect = getBlockRect(target);
  const targetTop =
    window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
  window.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' });
  return true;
}

/** TipTap analizza `content` come HTML — un titolo che contenga `&`/`<`/`>` va escaped prima, altrimenti verrebbe interpretato come markup invece che testo letterale. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
