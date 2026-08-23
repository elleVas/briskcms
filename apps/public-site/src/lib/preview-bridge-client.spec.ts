// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyBlockInsert,
  applyBlockPatch,
  applyBlockRemove,
  applyBlockReorder,
  applyBlockStyleCss,
  collectBlockElements,
  escapeHtml,
  findFieldElement,
  findFieldUnderPointer,
  findRealInteractiveAncestor,
  isBlockInteractive,
  isRootLevelBlock,
  parseEditingSection,
  toBlockRects,
} from './preview-bridge-client.js';

function requireElement(id: string): Element {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Test fixture is missing #${id}`);
  }
  return el;
}

function requireQuery(selector: string): Element {
  const el = document.querySelector(selector);
  if (!el) {
    throw new Error(`Test fixture is missing ${selector}`);
  }
  return el;
}

describe('parseEditingSection', () => {
  it('reads a valid header/footer value from the query string', () => {
    expect(parseEditingSection('?editingSection=header')).toBe('header');
    expect(parseEditingSection('?editingSection=footer')).toBe('footer');
  });

  it('returns null when absent — editing the page itself', () => {
    expect(parseEditingSection('')).toBeNull();
    expect(parseEditingSection('?token=abc')).toBeNull();
  });

  it('returns null for an unrecognized value instead of trusting it', () => {
    expect(parseEditingSection('?editingSection=sidebar')).toBeNull();
  });
});

describe('isBlockInteractive', () => {
  function buildDom() {
    document.body.innerHTML = `
      <header><div data-brisk-block-id="h1" id="h1"></div></header>
      <div data-brisk-block-id="p1" id="p1"></div>
      <footer><div data-brisk-block-id="f1" id="f1"></div></footer>
    `;
    return {
      headerBlock: requireElement('h1'),
      pageBlock: requireElement('p1'),
      footerBlock: requireElement('f1'),
    };
  }

  it('when editing the page (no section), only the page block is interactive', () => {
    const { headerBlock, pageBlock, footerBlock } = buildDom();
    expect(isBlockInteractive(pageBlock, null)).toBe(true);
    expect(isBlockInteractive(headerBlock, null)).toBe(false);
    expect(isBlockInteractive(footerBlock, null)).toBe(false);
  });

  it('when editing the header, only header blocks are interactive', () => {
    const { headerBlock, pageBlock, footerBlock } = buildDom();
    expect(isBlockInteractive(headerBlock, 'header')).toBe(true);
    expect(isBlockInteractive(pageBlock, 'header')).toBe(false);
    expect(isBlockInteractive(footerBlock, 'header')).toBe(false);
  });

  it('when editing the footer, only footer blocks are interactive', () => {
    const { headerBlock, pageBlock, footerBlock } = buildDom();
    expect(isBlockInteractive(footerBlock, 'footer')).toBe(true);
    expect(isBlockInteractive(pageBlock, 'footer')).toBe(false);
    expect(isBlockInteractive(headerBlock, 'footer')).toBe(false);
  });
});

describe('collectBlockElements', () => {
  it('finds every wrapper BlockRenderer.astro marks, in document order', () => {
    document.body.innerHTML = `
      <div data-brisk-block-id="a"></div>
      <div><div data-brisk-block-id="b"></div></div>
      <div data-brisk-no-block></div>
    `;
    const ids = collectBlockElements(document).map(
      (el) => (el as HTMLElement).dataset['briskBlockId'],
    );
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('findRealInteractiveAncestor', () => {
  it('finds the nearest real <a>/<button>/<details> ancestor', () => {
    document.body.innerHTML = `
      <a href="/somewhere"><span id="inside-link">click me</span></a>
      <button id="btn">go</button>
      <details id="det"><summary id="sum">toggle</summary></details>
      <div id="plain">nothing special</div>
    `;
    expect(
      findRealInteractiveAncestor(requireElement('inside-link'))?.tagName,
    ).toBe('A');
    expect(findRealInteractiveAncestor(requireElement('btn'))?.tagName).toBe(
      'BUTTON',
    );
    expect(findRealInteractiveAncestor(requireElement('sum'))?.tagName).toBe(
      'DETAILS',
    );
    expect(findRealInteractiveAncestor(requireElement('plain'))).toBeNull();
  });
});

describe('toBlockRects', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pairs each element with its own rect, keyed by its block id', () => {
    // jsdom doesn't implement Range.getBoundingClientRect at all, so it's
    // assigned directly rather than spied on.
    Range.prototype.getBoundingClientRect = vi.fn(
      () => ({ top: 1, left: 2, width: 3, height: 4 }) as DOMRect,
    );
    document.body.innerHTML = `<div data-brisk-block-id="a"></div>`;
    const el = requireQuery('[data-brisk-block-id]');

    expect(toBlockRects([el])).toEqual([
      { id: 'a', top: 1, left: 2, width: 3, height: 4 },
    ]);
  });

  it('skips an element with no block id rather than throwing', () => {
    document.body.innerHTML = `<div></div>`;
    const el = requireQuery('div');
    expect(toBlockRects([el])).toEqual([]);
  });
});

describe('applyBlockPatch', () => {
  it('replaces the matching wrapper via outerHTML, keeping its position', () => {
    document.body.innerHTML =
      '<div data-brisk-block-id="a">old</div>' +
      '<div data-brisk-block-id="b">unrelated</div>';

    const patched = applyBlockPatch(
      document,
      'a',
      '<div data-brisk-block-id="a" data-brisk-block-type="Text">new</div>',
    );

    expect(patched?.textContent).toBe('new');
    expect(document.body.innerHTML).toBe(
      '<div data-brisk-block-id="a" data-brisk-block-type="Text">new</div>' +
        '<div data-brisk-block-id="b">unrelated</div>',
    );
  });

  it('returns null without throwing when the block id is not in the document', () => {
    document.body.innerHTML = '<div data-brisk-block-id="a">old</div>';

    expect(applyBlockPatch(document, 'missing', '<div>new</div>')).toBeNull();
    expect(document.body.innerHTML).toBe(
      '<div data-brisk-block-id="a">old</div>',
    );
  });
});

describe('applyBlockInsert', () => {
  it('appends to the root blocks list for the current editing scope when there is no beforeBlockId', () => {
    document.body.innerHTML =
      '<div data-brisk-root-blocks="page">' +
      '<div data-brisk-block-id="a">first</div>' +
      '</div>';

    const inserted = applyBlockInsert(
      document,
      '<div data-brisk-block-id="b">second</div>',
      null,
      null,
      null,
    );

    expect(inserted?.textContent).toBe('second');
    expect(document.body.innerHTML).toBe(
      '<div data-brisk-root-blocks="page">' +
        '<div data-brisk-block-id="a">first</div>' +
        '<div data-brisk-block-id="b">second</div>' +
        '</div>',
    );
  });

  it('inserts before an existing root sibling, using its own parent as the container', () => {
    document.body.innerHTML =
      '<div data-brisk-root-blocks="page">' +
      '<div data-brisk-block-id="a">first</div>' +
      '</div>';

    applyBlockInsert(
      document,
      '<div data-brisk-block-id="b">new</div>',
      null,
      'a',
      null,
    );

    expect(document.body.innerHTML).toBe(
      '<div data-brisk-root-blocks="page">' +
        '<div data-brisk-block-id="b">new</div>' +
        '<div data-brisk-block-id="a">first</div>' +
        '</div>',
    );
  });

  it('picks the header/footer root list matching the current editing scope', () => {
    document.body.innerHTML =
      '<div data-brisk-root-blocks="page"></div>' +
      '<div data-brisk-root-blocks="header"></div>' +
      '<div data-brisk-root-blocks="footer"></div>';

    applyBlockInsert(
      document,
      '<div data-brisk-block-id="h1">nav</div>',
      null,
      null,
      'header',
    );

    expect(
      document.querySelector('[data-brisk-root-blocks="header"]')?.innerHTML,
    ).toBe('<div data-brisk-block-id="h1">nav</div>');
    expect(
      document.querySelector('[data-brisk-root-blocks="page"]')?.innerHTML,
    ).toBe('');
  });

  it("appends into an empty container via its wrapper's first element child", () => {
    document.body.innerHTML =
      '<div data-brisk-block-id="container-1">' +
      '<div class="rendered-container"></div>' +
      '</div>';

    const inserted = applyBlockInsert(
      document,
      '<div data-brisk-block-id="child-1">inside</div>',
      'container-1',
      null,
      null,
    );

    expect(inserted?.textContent).toBe('inside');
    expect(document.querySelector('.rendered-container')?.innerHTML).toBe(
      '<div data-brisk-block-id="child-1">inside</div>',
    );
  });

  it('returns null without throwing when neither a sibling nor the parent/root container can be found', () => {
    document.body.innerHTML = '<div>unrelated</div>';

    expect(
      applyBlockInsert(
        document,
        '<div>new</div>',
        'missing-parent',
        null,
        null,
      ),
    ).toBeNull();
  });

  it('finds the wrapper by data-brisk-block-id rather than assuming it is the first node, when the fragment leads with a <script> (Countdown/Form/MapEmbed... shape)', () => {
    document.body.innerHTML = '<div data-brisk-root-blocks="page"></div>';

    const inserted = applyBlockInsert(
      document,
      '<script>window.__briskTestFlag = 1;</script>' +
        '<div data-brisk-block-id="countdown-1">tick</div>',
      null,
      null,
      null,
    );

    expect(inserted?.getAttribute('data-brisk-block-id')).toBe('countdown-1');
  });

  it('recreates a sibling <script> so it is eligible to execute again, placed right after the block it belongs to', () => {
    document.body.innerHTML = '<div data-brisk-root-blocks="page"></div>';

    applyBlockInsert(
      document,
      '<script>window.__briskTestFlag = 1;</script>' +
        '<div data-brisk-block-id="countdown-1">tick</div>',
      null,
      null,
      null,
    );

    const rootList = requireQuery('[data-brisk-root-blocks="page"]');
    expect(rootList.children).toHaveLength(2);
    expect(rootList.children[0]?.getAttribute('data-brisk-block-id')).toBe(
      'countdown-1',
    );
    const script = rootList.children[1] as HTMLScriptElement;
    expect(script.tagName).toBe('SCRIPT');
    expect(script.textContent).toBe('window.__briskTestFlag = 1;');
  });

  it('copies every attribute onto the recreated <script>, including src/async/defer (Turnstile shape)', () => {
    document.body.innerHTML = '<div data-brisk-root-blocks="page"></div>';

    applyBlockInsert(
      document,
      '<div data-brisk-block-id="form-1">form</div>' +
        '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>',
      null,
      null,
      null,
    );

    const script = requireQuery(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );
    expect(script.hasAttribute('async')).toBe(true);
    expect(script.hasAttribute('defer')).toBe(true);
  });

  it('recreates a <script> nested inside the block wrapper too, in place', () => {
    document.body.innerHTML = '<div data-brisk-root-blocks="page"></div>';

    const inserted = applyBlockInsert(
      document,
      '<div data-brisk-block-id="stat-1">' +
        '<script>window.__briskTestFlag = 2;</script>' +
        '<span>42</span>' +
        '</div>',
      null,
      null,
      null,
    );

    const nestedScript = inserted?.querySelector('script');
    expect(nestedScript?.textContent).toBe('window.__briskTestFlag = 2;');
    expect(inserted?.querySelector('span')?.textContent).toBe('42');
  });
});

describe('applyBlockRemove', () => {
  it('removes the matching block from the document', () => {
    document.body.innerHTML =
      '<div data-brisk-block-id="a">first</div>' +
      '<div data-brisk-block-id="b">second</div>';

    const removed = applyBlockRemove(document, 'a');

    expect(removed).toBe(true);
    expect(document.body.innerHTML).toBe(
      '<div data-brisk-block-id="b">second</div>',
    );
  });

  it('returns false without throwing when the block id is not in the document', () => {
    document.body.innerHTML = '<div data-brisk-block-id="a">first</div>';

    expect(applyBlockRemove(document, 'missing')).toBe(false);
    expect(document.body.innerHTML).toBe(
      '<div data-brisk-block-id="a">first</div>',
    );
  });
});

describe('applyBlockReorder', () => {
  it('re-appends the existing siblings in the given order, moving them (not cloning)', () => {
    document.body.innerHTML =
      '<div data-brisk-root-blocks="page">' +
      '<div data-brisk-block-id="a">first</div>' +
      '<div data-brisk-block-id="b">second</div>' +
      '<div data-brisk-block-id="c">third</div>' +
      '</div>';
    const originalA = document.querySelector('[data-brisk-block-id="a"]');

    applyBlockReorder(document, null, ['c', 'a', 'b'], null);

    expect(document.body.innerHTML).toBe(
      '<div data-brisk-root-blocks="page">' +
        '<div data-brisk-block-id="c">third</div>' +
        '<div data-brisk-block-id="a">first</div>' +
        '<div data-brisk-block-id="b">second</div>' +
        '</div>',
    );
    // Lo stesso nodo, solo spostato — mai clonato via innerHTML.
    expect(document.querySelector('[data-brisk-block-id="a"]')).toBe(originalA);
  });

  it('reorders within the scope matching the current editing section, when header/footer/page coexist', () => {
    document.body.innerHTML =
      '<div data-brisk-root-blocks="header">' +
      '<div data-brisk-block-id="nav-1">nav</div>' +
      '<div data-brisk-block-id="nav-2">nav2</div>' +
      '</div>' +
      '<div data-brisk-root-blocks="page"></div>';

    applyBlockReorder(document, null, ['nav-2', 'nav-1'], 'header');

    expect(
      document.querySelector('[data-brisk-root-blocks="header"]')?.innerHTML,
    ).toBe(
      '<div data-brisk-block-id="nav-2">nav2</div>' +
        '<div data-brisk-block-id="nav-1">nav</div>',
    );
  });

  it('ignores ids no longer present in the document instead of throwing', () => {
    document.body.innerHTML =
      '<div data-brisk-root-blocks="page">' +
      '<div data-brisk-block-id="a">first</div>' +
      '</div>';

    applyBlockReorder(document, null, ['missing', 'a'], null);

    expect(
      document.querySelector('[data-brisk-root-blocks="page"]')?.innerHTML,
    ).toBe('<div data-brisk-block-id="a">first</div>');
  });

  it('does nothing when none of the ordered ids are present', () => {
    document.body.innerHTML = '<div data-brisk-root-blocks="page"></div>';

    expect(() =>
      applyBlockReorder(document, null, ['missing-1', 'missing-2'], null),
    ).not.toThrow();
  });
});

describe('findFieldElement', () => {
  it('finds the field node inside the matching block', () => {
    document.body.innerHTML =
      '<div data-brisk-block-id="hero-1">' +
      '<h1 data-brisk-field="title">Titolo</h1>' +
      '<p data-brisk-field="subtitle">Sottotitolo</p>' +
      '</div>';

    const el = findFieldElement(document, 'hero-1', 'subtitle');

    expect(el?.tagName).toBe('P');
    expect(el?.textContent).toBe('Sottotitolo');
  });

  it('returns null when the block id does not exist', () => {
    document.body.innerHTML = '<div data-brisk-block-id="hero-1"></div>';
    expect(findFieldElement(document, 'missing', 'title')).toBeNull();
  });

  it('returns null when the field does not exist on that block', () => {
    document.body.innerHTML =
      '<div data-brisk-block-id="hero-1"><h1 data-brisk-field="title"></h1></div>';
    expect(findFieldElement(document, 'hero-1', 'subtitle')).toBeNull();
  });
});

describe('findFieldUnderPointer', () => {
  it('finds the data-brisk-field value nearest the click target', () => {
    document.body.innerHTML =
      '<div data-brisk-block-id="hero-1">' +
      '<h1 data-brisk-field="title"><span id="inner">Titolo</span></h1>' +
      '</div>';
    const blockEl = requireQuery('[data-brisk-block-id="hero-1"]');
    const target = requireElement('inner');

    expect(findFieldUnderPointer(blockEl, target)).toBe('title');
  });

  it('returns null when the click landed outside any field, even inside the block', () => {
    document.body.innerHTML =
      '<div data-brisk-block-id="hero-1">' +
      '<h1 data-brisk-field="title">Titolo</h1>' +
      '<div id="padding"></div>' +
      '</div>';
    const blockEl = requireQuery('[data-brisk-block-id="hero-1"]');
    const target = requireElement('padding');

    expect(findFieldUnderPointer(blockEl, target)).toBeNull();
  });

  it('returns null for a field element that belongs to a different block', () => {
    document.body.innerHTML =
      '<div data-brisk-block-id="hero-1"></div>' +
      '<div data-brisk-block-id="hero-2"><h1 data-brisk-field="title" id="other">Altro</h1></div>';
    const blockEl = requireQuery('[data-brisk-block-id="hero-1"]');
    const target = requireElement('other');

    expect(findFieldUnderPointer(blockEl, target)).toBeNull();
  });
});

describe('isRootLevelBlock', () => {
  it('is true for a block with no ancestor block wrapper', () => {
    document.body.innerHTML =
      '<div class="mx-auto flex max-w-5xl">' +
      '<div data-brisk-block-id="hero-1" id="hero-1"></div>' +
      '</div>';
    expect(isRootLevelBlock(requireElement('hero-1'))).toBe(true);
  });

  it('is false for a block nested inside another block wrapper (e.g. a Container child)', () => {
    document.body.innerHTML =
      '<div data-brisk-block-id="container-1">' +
      '<div data-brisk-block-id="text-1" id="text-1"></div>' +
      '</div>';
    expect(isRootLevelBlock(requireElement('text-1'))).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('escapes &, < and > so TipTap never parses user text as markup', () => {
    expect(escapeHtml('Tom & Jerry <script>')).toBe(
      'Tom &amp; Jerry &lt;script&gt;',
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Ciao mondo')).toBe('Ciao mondo');
  });
});

describe('applyBlockStyleCss', () => {
  afterEach(() => {
    document.getElementById('brisk-block-style-overrides')?.remove();
  });

  it('creates the style element on the first call and writes the css into it', () => {
    applyBlockStyleCss(document, '.brisk-button { --brisk-override-bg: red; }');

    const styleEl = document.getElementById('brisk-block-style-overrides');
    expect(styleEl?.tagName).toBe('STYLE');
    expect(styleEl?.textContent).toBe(
      '.brisk-button { --brisk-override-bg: red; }',
    );
    expect(styleEl?.parentElement).toBe(document.head);
  });

  it('reuses the same element and replaces its content on a later call, not appending a second one', () => {
    applyBlockStyleCss(document, '.brisk-button { --brisk-override-bg: red; }');
    applyBlockStyleCss(
      document,
      '.brisk-banner { --brisk-override-bg: blue; }',
    );

    const styleEls = document.head.querySelectorAll(
      '#brisk-block-style-overrides',
    );
    expect(styleEls).toHaveLength(1);
    expect(styleEls[0].textContent).toBe(
      '.brisk-banner { --brisk-override-bg: blue; }',
    );
  });

  it('clears the style element when called with an empty string (last styled type removed)', () => {
    applyBlockStyleCss(document, '.brisk-button { --brisk-override-bg: red; }');
    applyBlockStyleCss(document, '');

    expect(
      document.getElementById('brisk-block-style-overrides')?.textContent,
    ).toBe('');
  });
});
