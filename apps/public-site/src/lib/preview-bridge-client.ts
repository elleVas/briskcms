import { type BlockAlign, type BlockRect } from '@brisk/shared-types';
import { getBlockRect } from './get-block-rect';
import { ROOT_BLOCK_CLASS } from './root-block-layout';

/**
 * Pure parsing/predicate and DOM-patching functions — deliberately kept
 * apart from the orchestrator proper (`initPreviewBridge`, in
 * init-preview-bridge.ts) precisely so each can be tested on its own
 * without mounting the whole bridge (see preview-bridge-client.spec.ts
 * against init-preview-bridge.spec.ts). No module-level state here — every
 * function takes its own `root`/`blockId`/etc. explicitly.
 */

export type EditingSection = 'header' | 'footer';

/**
 * `null` = the page's content is being edited — see the visual editor plan,
 * Day 1/2: the same page-preview route also serves the header/footer,
 * distinguished only by this query param.
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
 * The nearest genuinely interactive element (link/button/form/details), if
 * there is one — without intercepting it, the first click on one of these
 * would navigate the iframe away and kill the editing session (Puck did not
 * have this problem: a React portal-rendered canvas, never real anchors).
 */
export function findRealInteractiveAncestor(target: Element): Element | null {
  return target.closest('a, button, details');
}

export function blockIdOf(el: Element): string | null {
  return (el as HTMLElement).dataset['briskBlockId'] ?? null;
}

/**
 * True only when NO ancestor of the block is itself a block wrapper —
 * direct reordering on the canvas (Day 3/4) is scoped to top-level blocks,
 * the same choice layers-panel.tsx made ("reordering between nested
 * siblings... stays a separate TODO"). It starts from `parentElement`
 * rather than `blockEl` itself, or `closest` would always find at least
 * `blockEl`.
 */
export function isRootLevelBlock(blockEl: Element): boolean {
  return blockEl.parentElement?.closest('[data-brisk-block-id]') == null;
}

/** The nearest `data-brisk-field` value under a click point, within the block's own bounds — `null` when the double click landed on the block but outside every `inlineEditable` field (a padding area, say). */
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
 * Targeted replacement after render-block-fragment (Day 3) — `html` already
 * carries its own `data-brisk-block-id` wrapper (RenderSingleBlock.astro
 * builds it with the same id), so `outerHTML` replaces exactly the right
 * node. Returns the new element (to re-observe it with the ResizeObserver)
 * or `null` when the block is no longer in the document — removed in the
 * meantime by another action, say, which is not an error worth reporting.
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
 * The wrapper a root block lives in, built to match the one
 * PublicPageContent.astro renders server-side.
 *
 * The new block goes in as the LAST one (that is where an append puts it,
 * and an insert-before hands its own position to the sibling), so it takes
 * the last block's spacing: no default gap below it.
 */
function wrapRootBlock(blockEl: Element): Element {
  const wrapper = document.createElement('div');
  wrapper.className = ROOT_BLOCK_CLASS;
  wrapper.appendChild(blockEl);
  return wrapper;
}

/**
 * The `.brisk-root-block` wrapper `el` sits directly inside, if any.
 *
 * A root block is the only block with one as its immediate parent — a
 * nested block has a root wrapper somewhere up the tree too, which is why
 * this checks the parent rather than using `closest`.
 */
function rootWrapperOf(el: Element): Element | null {
  const parent = el.parentElement;
  return parent?.classList.contains(ROOT_BLOCK_CLASS) ? parent : null;
}

/**
 * Sets how much width a root block claims (ADR-0049) — see
 * EditorSetBlockAlignMessage.
 *
 * The attribute goes on the wrapper, not the block: that is where the CSS
 * reads it, and it is also why this is its own message rather than a
 * re-render — patching the block's HTML would replace the element inside
 * the wrapper and leave the wrapper's own attributes exactly as they were.
 *
 * A silent no-op for a block that is not root-level, the same discipline
 * as the rest of the bridge: the editor only offers the control at the top
 * level, and a message arriving for anything else asks for something the
 * page has no way to express.
 */
export function applyBlockAlign(
  root: ParentNode,
  blockId: string,
  align: BlockAlign | null,
): boolean {
  const target = root.querySelector(`[data-brisk-block-id="${blockId}"]`);
  const wrapper = target ? rootWrapperOf(target) : null;
  if (!wrapper) {
    return false;
  }
  // `content` is written as the ABSENCE of the attribute, matching how the
  // server renders it — anything else leaves two ways to express the same
  // page, and the canvas showing one while a reload shows the other.
  if (align && align !== 'content') {
    wrapper.setAttribute('data-brisk-align', align);
  } else {
    wrapper.removeAttribute('data-brisk-align');
  }
  return true;
}

/**
 * Inserts a block the iframe has NEVER seen before (insert/duplicate) — see
 * EditorInsertBlockMessage. It finds the right DOM container without having
 * to know the internal structure of every container block type
 * (Container/Columns/Accordion/...): if a sibling already exists
 * (`beforeBlockId`), ITS `parentElement` is by construction the right
 * container (every block is a `display:contents` wrapper placed directly as
 * a child of that container, never wrapped in anything else — see
 * BlockRenderer.astro). Otherwise (an empty container, or the root) an
 * explicit reference is needed: the first child of the container block's
 * wrapper (every container block renders `<slot/>` as the sole content of
 * its own root element) for a nested insert, or the
 * `data-brisk-root-blocks="page"/"header"/"footer"` marker
 * (PublicPageContent.astro/PageLayout.astro) for the root, distinguished by
 * scope because the three root lists can coexist on the same page.
 */
export function applyBlockInsert(
  root: ParentNode,
  html: string,
  parentId: string | null,
  beforeBlockId: string | null,
  editingSection: EditingSection | null,
): Element | null {
  const beforeBlockEl = beforeBlockId
    ? root.querySelector(`[data-brisk-block-id="${beforeBlockId}"]`)
    : null;

  // A ROOT block is not a direct child of its list: PublicPageContent.astro
  // puts every one of them inside a `.brisk-root-block` wrapper carrying
  // the spacing and, since ADR-0049, the width and alignment that used to
  // sit on `<main>`. So the sibling to insert before is that WRAPPER, and
  // the container is the wrapper's parent — using the block element's own
  // parent, as this did, made the new block a CHILD of its neighbour's
  // wrapper: nested inside the block it was supposed to sit above, sharing
  // its spacing and its width.
  //
  // `closest` and not "is the parent a root wrapper": a nested block is
  // inside a root wrapper too, several levels down, and only the one whose
  // wrapper is its immediate parent is a root block.
  const beforeEl = beforeBlockEl
    ? (rootWrapperOf(beforeBlockEl) ?? beforeBlockEl)
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
  // Whether this insert lands in the PAGE's root list, whichever branch
  // above found it — an append with no sibling finds the marker directly,
  // an insert-before finds it as the wrapper's parent.
  //
  // `'page'` specifically, not "any root list": the header and footer lists
  // space their blocks with a flex `gap` on the list itself
  // (PageLayout.astro) and have no per-block wrapper at all. Wrapping a
  // block inserted there would put a div nothing styles between the flex
  // container and its item.
  const isRootInsert =
    container.getAttribute('data-brisk-root-blocks') === 'page';

  const template = document.createElement('template');
  template.innerHTML = html.trim();

  // The real wrapper is not necessarily the fragment's first child: some
  // blocks (Countdown, Form, MapEmbed...) have their own <script> rendered
  // as a sibling of the wrapper — RenderSingleBlock has no shared page to
  // "hang it off", unlike a whole-page render.
  const newNode = template.content.querySelector('[data-brisk-block-id]');
  if (!newNode) {
    return null;
  }

  // A <script> moved here through innerHTML/<template> is flagged "already
  // started" by the spec and NEVER runs on its own, not even once
  // reconnected to the document — it has to be recreated from scratch (the
  // same reason Countdown/Stat/ImageSlider/Tabs/Testimonials/BeforeAfter/
  // Form/MapEmbed stayed empty until the page was reloaded; for Form/
  // NewsletterSignup this also restarts Turnstile's <script src>, which
  // self-renders on every .cf-turnstile it finds). Replaced in place, before
  // any node is moved: if it is nested inside newNode it reconnects by
  // itself when newNode enters the document (the whole subtree connects in
  // one go, before any script inside it runs); if it is a sibling of
  // newNode it stays inside `template.content` and has to be moved
  // separately, immediately afterwards.
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

  // A root block travels in its wrapper. Building it here rather than
  // asking the server for it keeps the insert a single round trip, and
  // root-block-layout.ts is shared with the page renderer precisely so the
  // two agree: a wrapper missing here is a block rendered outside the
  // content column until the next reload.
  const insertedNode: Element = isRootInsert ? wrapRootBlock(newNode) : newNode;

  if (beforeEl) {
    container.insertBefore(insertedNode, beforeEl);
  } else {
    // No re-spacing to do on the block that was last (ADR-0050): the gap
    // is `.brisk-root-block:last-child` in CSS now, so moving the last
    // position to another element is something the stylesheet notices on
    // its own. It used to be an inline style computed per block, which
    // meant every insert and delete had to recompute its neighbours'.
    container.appendChild(insertedNode);
  }

  // Every sibling node left in `template.content` (typically the <script>
  // recreated above, when it is a sibling rather than nested) is reattached
  // right after newNode, in the same relative order as the original HTML.
  // `newNode`, not the wrapper around it: a server-rendered page puts the
  // block's sibling <script> inside the same root wrapper as the block
  // itself (the wrapper encloses BlockRenderer's whole output), and the
  // canvas has to match that or the two DOMs differ.
  let anchor: ChildNode = newNode;
  for (const sibling of Array.from(template.content.childNodes)) {
    anchor.after(sibling);
    anchor = sibling;
  }

  return newNode;
}

/**
 * The fixed id of the `<style>` injected for the "component-level" override
 * (docs/adr/0022) — a single element, rewritten in full on every save from
 * the "Style" button (the parent already sends the whole updated
 * `blockStyles` map, not a delta), never accumulated.
 */
const BLOCK_STYLE_CSS_ELEMENT_ID = 'brisk-block-style-overrides';

/** Writes or replaces the `<style>` holding the per-type overrides (docs/adr/0022) — see EditorUpdateBlockStyleCssMessage. It creates the element if there is none yet (the session's first save), and reuses it otherwise. */
export function applyBlockStyleCss(root: Document, css: string): void {
  let styleEl = root.getElementById(BLOCK_STYLE_CSS_ELEMENT_ID);
  if (!styleEl) {
    styleEl = root.createElement('style');
    styleEl.id = BLOCK_STYLE_CSS_ELEMENT_ID;
    root.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

/** Removes a deleted block from the iframe's DOM — `true` when a node was actually removed, `false` when it was no longer there (not an error: an earlier action may have taken it out already). */
export function applyBlockRemove(root: ParentNode, blockId: string): boolean {
  const target = root.querySelector(`[data-brisk-block-id="${blockId}"]`);
  if (!target) {
    return false;
  }
  // A root block leaves with its wrapper. Removing the block alone left an
  // empty `.brisk-root-block` behind, still carrying the gap below it — a
  // blank band where the block used to be, until the next reload. It also
  // takes any sibling <script> the block rendered alongside itself, which
  // lives in that same wrapper.
  const wrapper = rootWrapperOf(target);
  // The wrapper goes with the block — see ADR-0049. Nothing to re-space
  // afterwards: the promoted last block picks up `:last-child` by itself.
  (wrapper ?? target).remove();
  return true;
}

/**
 * Reorders the EXISTING siblings (all already rendered) to match
 * `orderedIds` — see EditorReorderBlocksMessage. The container is found
 * through the FIRST sibling still present in the DOM (its `parentElement`,
 * the same heuristic as `applyBlockInsert`): no knowledge of the container
 * block's internal structure is needed. An id in `orderedIds` that is no
 * longer in the DOM is ignored silently — not every sibling necessarily
 * still exists (a removal just applied may not yet be reflected in the list
 * the caller built).
 */
export function applyBlockReorder(
  root: ParentNode,
  parentId: string | null,
  orderedIds: string[],
  editingSection: EditingSection | null,
): void {
  const existing = orderedIds
    .map((id) => root.querySelector(`[data-brisk-block-id="${id}"]`))
    .filter((el): el is Element => el !== null)
    // What moves is the WRAPPER, for a root block: reordering the block
    // elements themselves took the first block's wrapper as the container
    // and then appended every other block INTO it, collapsing the whole
    // page into one wrapper and emptying the rest.
    .map((el) => rootWrapperOf(el) ?? el);
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

  // `appendChild` on a node already in the DOM MOVES it (no clone) — so
  // re-appending them in the desired sequence leaves them in that final
  // order.
  for (const el of existing) {
    container.appendChild(el);
  }
}

/** The exact node of an `inlineEditable` field inside a block — marked by hand in the block's Astro component (see Hero.astro). `null` when the block or the field does not exist (never an error worth reporting: a blockId/field that has gone stale, after a fragment patch for instance, is a normal case). */
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
 * Brings block `blockId` into view (Layers panel, right-hand column) —
 * `true` when the block was found and the scroll started, `false` when it
 * is no longer in the DOM (just removed by another action, say): the same
 * "not an error worth reporting" case as `applyBlockPatch`/
 * `applyBlockRemove`.
 *
 * NOT a plain `target.scrollIntoView()`: `target` is BlockRenderer.astro's
 * `display:contents` wrapper (see get-block-rect.ts), so it never has a box
 * of its own — `scrollIntoView()` on such an element is a no-op in most
 * browsers (a live-verified bug: clicking in the Layers panel selected the
 * block but the canvas never moved). `getBlockRect` measures the rendered
 * content through a `Range` instead (which works identically for an
 * ordinary element), and the scroll is then computed by hand to centre it
 * vertically — the same semantics as `scrollIntoView({block:'center'})` on
 * an element with a real box.
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

/** TipTap parses `content` as HTML — a title containing `&`/`<`/`>` has to be escaped first, or it would be read as markup rather than literal text. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
