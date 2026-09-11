import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '@brisk/shared-types';
import { useBlockStyleSheet } from './use-block-style-sheet';

function setup(tree: Block[]) {
  const updateBlockStyleCss = vi.fn<(css: string) => void>();
  const { result } = renderHook(() =>
    useBlockStyleSheet({ updateBlockStyleCss }, { current: tree }),
  );
  return {
    sheet: result.current,
    sent: () => updateBlockStyleCss.mock.calls.at(-1)?.[0],
  };
}

describe('useBlockStyleSheet', () => {
  const styled: Block = {
    id: 'hero',
    type: 'Hero',
    props: {},
    styleOverride: { base: { textColor: '#ff0000', marginTop: '3rem' } },
  };

  it('sends the instance rules of the tree it is given, not only of the draft', () => {
    const { sheet, sent } = setup([]);

    sheet.refresh([styled]);

    expect(sent()).toContain('.b-hero');
  });

  /*
   * A root block's margins sit on its wrapper (`.brisk-rb-<id>`). Without
   * them a margin set in the canvas, or carried by a pasted block, did not
   * show until the page was reloaded.
   */
  it('sends the margin rules of root blocks beside the instance rules', () => {
    const { sheet, sent } = setup([styled]);

    sheet.refresh();

    expect(sent()).toContain('.brisk-rb-hero');
    expect(sent()).toContain('margin-top');
  });

  it('keeps the per-type tier it was last given on every later refresh', () => {
    const { sheet, sent } = setup([styled]);

    sheet.replaceTypeCss('.brisk-hero { color: blue; }');
    sheet.refresh();

    expect(sent()).toContain('.brisk-hero { color: blue; }');
    expect(sent()?.startsWith('@layer brisk.class, brisk.instance;')).toBe(
      true,
    );
  });

  it('clears the sheet when nothing on the page carries a style', () => {
    const { sheet, sent } = setup([{ id: 'plain', type: 'Hero', props: {} }]);

    sheet.refresh();

    expect(sent()).toBe('');
  });
});
