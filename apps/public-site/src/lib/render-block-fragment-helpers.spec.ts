import { describe, expect, it } from 'vitest';
import {
  buildFragmentBlock,
  isValidRenderBlockFragmentBody,
  renderBlockFragmentCorsHeaders,
} from './render-block-fragment-helpers';

describe('isValidRenderBlockFragmentBody', () => {
  const valid = {
    pageId: 'page-1',
    token: 'tok',
    blockId: 'block-1',
    blockType: 'Button',
    props: { label: 'Click me' },
  };

  it('accepts a well-formed body', () => {
    expect(isValidRenderBlockFragmentBody(valid)).toBe(true);
  });

  it('rejects a body missing any required field', () => {
    for (const key of Object.keys(valid) as (keyof typeof valid)[]) {
      const rest = { ...valid };
      delete rest[key];
      expect(isValidRenderBlockFragmentBody(rest)).toBe(false);
    }
  });

  it('rejects non-object data', () => {
    expect(isValidRenderBlockFragmentBody(null)).toBe(false);
    expect(isValidRenderBlockFragmentBody('nonsense')).toBe(false);
    expect(isValidRenderBlockFragmentBody(42)).toBe(false);
  });

  it('rejects props that are not an object', () => {
    expect(isValidRenderBlockFragmentBody({ ...valid, props: 'nope' })).toBe(
      false,
    );
  });

  it('accepts an optional children array', () => {
    expect(
      isValidRenderBlockFragmentBody({
        ...valid,
        children: [{ id: 'child-1', type: 'Text', props: { body: 'x' } }],
      }),
    ).toBe(true);
  });

  it('rejects children that are not an array', () => {
    expect(isValidRenderBlockFragmentBody({ ...valid, children: 'nope' })).toBe(
      false,
    );
  });

  it('accepts an optional styleOverride object', () => {
    expect(
      isValidRenderBlockFragmentBody({
        ...valid,
        styleOverride: { backgroundColor: '#ff0000' },
      }),
    ).toBe(true);
  });

  it('rejects a styleOverride that is not an object', () => {
    expect(
      isValidRenderBlockFragmentBody({ ...valid, styleOverride: 'nope' }),
    ).toBe(false);
  });
});

describe('renderBlockFragmentCorsHeaders', () => {
  it('allows only POST/OPTIONS and only the editor-app origin', () => {
    const headers = renderBlockFragmentCorsHeaders();
    expect(headers['Access-Control-Allow-Origin']).toBe(
      'http://localhost:4200',
    );
    expect(headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
  });
});

/*
 * A reusable section keeps its blocks on the server: the page's own render
 * grafts them at read time, but the canvas re-renders ONE block, and a
 * Section handed over on its own carries a reference and nothing else. It
 * used to come back as "this section has not been published yet" — for a
 * section plainly published and visible further up the same page.
 */
describe('buildFragmentBlock', () => {
  const page = {
    content: [
      {
        id: 'placed',
        type: 'Section',
        props: { section: { sectionId: 'cta', sectionName: 'Footer CTA' } },
        children: [{ id: 'placed--h', type: 'Heading', props: { text: 'Hi' } }],
      },
    ],
    seoMeta: { title: '', description: '' },
    locale: 'en',
    translations: [],
    ancestors: [],
    site: {} as never,
    header: null,
    footer: null,
    headerSticky: false,
    sections: {
      cta: [{ id: 'h', type: 'Heading', props: { text: 'Hi' } }],
    },
  } as never;

  it('grafts the blocks of a section the page uses', () => {
    const block = buildFragmentBlock(
      {
        pageId: 'p1',
        token: 'tok',
        blockId: 'copy',
        blockType: 'Section',
        props: { section: { sectionId: 'cta', sectionName: 'Footer CTA' } },
      },
      page,
    );

    expect(block.children?.map((child) => child.type)).toEqual(['Heading']);
    // The ids are derived from the instance, so two copies of one section
    // on a page never share a per-instance style rule.
    expect(block.children?.[0]?.id).toBe('copy--h');
  });

  it('leaves a section the page does not use empty, for the editor to reload', () => {
    const block = buildFragmentBlock(
      {
        pageId: 'p1',
        token: 'tok',
        blockId: 'copy',
        blockType: 'Section',
        props: { section: { sectionId: 'unknown', sectionName: 'Other' } },
      },
      page,
    );

    expect(block.children).toEqual([]);
  });

  it('keeps the children the caller passed rather than reading the page back', () => {
    const block = buildFragmentBlock(
      {
        pageId: 'p1',
        token: 'tok',
        blockId: 'box',
        blockType: 'Container',
        props: {},
        children: [{ id: 'fresh', type: 'Text', props: { body: 'new' } }],
      },
      page,
    );

    expect(block.children?.map((child) => child.id)).toEqual(['fresh']);
  });
});
