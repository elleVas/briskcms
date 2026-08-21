// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyBlockInsert,
  applyBlockPatch,
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
