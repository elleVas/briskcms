// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { markEmptyBlocks } from './preview-bridge-client';

/**
 * Nineteen block types render their root conditionally, and the editor's
 * wrapper is `display: contents` — no box of its own. So a freshly
 * inserted Icon, Video or Social link occupied zero pixels: impossible to
 * select, edit or delete from the canvas, with a row in the Layers panel
 * as the only sign it existed.
 */
function wrapper(type: string, inner: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-brisk-block-id', `${type}-1`);
  el.setAttribute('data-brisk-block-type', type);
  el.style.display = 'contents';
  el.innerHTML = inner;
  return el;
}

describe('markEmptyBlocks', () => {
  it('gives a block that rendered to nothing a box to be clicked', () => {
    const root = document.createElement('div');
    const empty = wrapper('Icon', '');
    root.append(empty);

    markEmptyBlocks(root);

    // jsdom reports 0 for everything, which is exactly the case under
    // test: what matters is that an empty block stops being
    // `display: contents` and carries the marker the placeholder needs.
    expect(empty.dataset['briskEmpty']).toBe('');
    expect(empty.style.display).toBe('block');
  });

  it('names the type, so the placeholder can say which block it is', () => {
    const root = document.createElement('div');
    const empty = wrapper('SocialLink', '');
    root.append(empty);

    markEmptyBlocks(root);

    expect(empty.getAttribute('data-brisk-block-type')).toBe('SocialLink');
  });

  it('clears the marker when a block stops being empty', () => {
    const root = document.createElement('div');
    const el = wrapper('Icon', '');
    root.append(el);
    markEmptyBlocks(root);
    expect(el.dataset['briskEmpty']).toBe('');

    // Filled in — and measuring must start from its own box again, or a
    // block marked once would keep measuring as the placeholder.
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ height: 24 }) as DOMRect,
      configurable: true,
    });
    markEmptyBlocks(root);

    expect(el.dataset['briskEmpty']).toBeUndefined();
    expect(el.style.display).toBe('contents');
  });

  it('leaves a block belonging to a section instance alone', () => {
    // Same rule as everything else on the canvas: those blocks belong to
    // the section, not to this page (docs/adr/0059).
    const root = document.createElement('div');
    const section = document.createElement('div');
    section.setAttribute('data-brisk-section-content', '');
    const inside = wrapper('Icon', '');
    section.append(inside);
    root.append(section);

    markEmptyBlocks(root);

    expect(inside.dataset['briskEmpty']).toBeUndefined();
  });
});
