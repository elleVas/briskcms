// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runBlockBehaviorsInSubtree } from './run-block-behaviors-in-subtree.js';

describe('runBlockBehaviorsInSubtree', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wires up an interactive block when the given root itself is the wrapper', () => {
    document.body.innerHTML = `
      <div data-brisk-block-id="tabs-1" data-brisk-block-type="Tabs">
        <div class="brisk-tabs">
          <div class="brisk-tab-panel" data-tab-label="Uno" hidden></div>
        </div>
      </div>
    `;
    const wrapper = document.querySelector('[data-brisk-block-id="tabs-1"]')!;

    runBlockBehaviorsInSubtree(wrapper);

    expect(document.querySelector('.brisk-tabs__list')).not.toBeNull();
  });

  it('wires up every interactive block nested inside a live-inserted container', () => {
    document.body.innerHTML = `
      <div data-brisk-block-id="columns-1" data-brisk-block-type="Columns">
        <div data-brisk-block-id="tabs-1" data-brisk-block-type="Tabs">
          <div class="brisk-tabs">
            <div class="brisk-tab-panel" data-tab-label="Uno" hidden></div>
          </div>
        </div>
        <div data-brisk-block-id="btt-1" data-brisk-block-type="BackToTop">
          <button class="brisk-back-to-top" type="button"></button>
        </div>
      </div>
    `;
    const root = document.querySelector('[data-brisk-block-id="columns-1"]')!;
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;

    runBlockBehaviorsInSubtree(root);

    expect(document.querySelector('.brisk-tabs__list')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('.brisk-back-to-top')?.click();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('does nothing for a block type with no registered behaviors', () => {
    document.body.innerHTML = `
      <div data-brisk-block-id="hero-1" data-brisk-block-type="Hero"></div>
    `;
    const wrapper = document.querySelector('[data-brisk-block-id="hero-1"]')!;

    expect(() => runBlockBehaviorsInSubtree(wrapper)).not.toThrow();
  });
});
