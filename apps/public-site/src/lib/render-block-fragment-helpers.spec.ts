import { describe, expect, it } from 'vitest';
import {
  isValidRenderBlockFragmentBody,
  renderBlockFragmentCorsHeaders,
} from './render-block-fragment-helpers.js';

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
