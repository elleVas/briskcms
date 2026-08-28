import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  OverlayLayer,
  toAddChildStyle,
  toDropIndicatorStyle,
  toInsertPointStyle,
  toOverlayStyle,
  toPillStyle,
  toToolbarStyle,
} from './overlay-layer.js';

describe('toOverlayStyle', () => {
  it("adds the iframe's own offset to a viewport-relative block rect", () => {
    const style = toOverlayStyle(
      { top: 100, left: 50, width: 800, height: 600 },
      { id: 'a', top: 10, left: 20, width: 300, height: 40 },
    );

    expect(style).toEqual({
      position: 'fixed',
      top: 110,
      left: 70,
      width: 300,
      height: 40,
    });
  });
});

describe('toDropIndicatorStyle', () => {
  it("adds the iframe's own offset and spans its full width", () => {
    const style = toDropIndicatorStyle(
      { top: 100, left: 50, width: 800, height: 600 },
      30,
    );

    expect(style).toEqual({
      position: 'fixed',
      top: 129,
      left: 50,
      width: 800,
      height: 2,
    });
  });
});

describe('toPillStyle', () => {
  it('positions the breadcrumb pill above the block, aligned to its left edge', () => {
    const style = toPillStyle(
      { top: 100, left: 50, width: 800, height: 600 },
      { id: 'a', top: 10, left: 20, width: 300, height: 40 },
    );

    expect(style).toEqual({ position: 'fixed', top: 82, left: 70 });
  });
});

describe('toToolbarStyle', () => {
  it('positions the toolbar to the right of the block when there is room', () => {
    const style = toToolbarStyle(
      { top: 0, left: 0, width: 800, height: 600 },
      { id: 'a', top: 10, left: 20, width: 100, height: 40 },
    );

    expect(style).toEqual({ position: 'fixed', top: 10, left: 128 });
  });

  it('clamps the toolbar inside the right edge of the iframe for a full-width block', () => {
    const style = toToolbarStyle(
      { top: 0, left: 0, width: 800, height: 600 },
      { id: 'a', top: 10, left: 0, width: 800, height: 40 },
    );

    expect(style).toEqual({ position: 'fixed', top: 10, left: 752 });
  });
});

describe('toInsertPointStyle', () => {
  it('centers the insert point on the top edge of the block', () => {
    const style = toInsertPointStyle(
      { top: 0, left: 0, width: 800, height: 600 },
      { id: 'a', top: 100, left: 20, width: 300, height: 40 },
      'top',
    );

    expect(style).toEqual({ position: 'fixed', top: 88, left: 158 });
  });

  it('centers the insert point on the bottom edge of the block', () => {
    const style = toInsertPointStyle(
      { top: 0, left: 0, width: 800, height: 600 },
      { id: 'a', top: 100, left: 20, width: 300, height: 40 },
      'bottom',
    );

    expect(style).toEqual({ position: 'fixed', top: 128, left: 158 });
  });
});

describe('toAddChildStyle', () => {
  it('positions the add-child control inside the top-right corner of the container', () => {
    const style = toAddChildStyle(
      { top: 0, left: 0, width: 800, height: 600 },
      { id: 'a', top: 100, left: 20, width: 300, height: 40 },
    );

    expect(style).toEqual({ position: 'fixed', top: 104, left: 288 });
  });
});

describe('OverlayLayer', () => {
  function setup() {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    iframe.getBoundingClientRect = vi.fn(
      () => ({ top: 100, left: 50, width: 800, height: 600 }) as DOMRect,
    );
    const ref = createRef<HTMLIFrameElement>();
    ref.current = iframe;
    return ref;
  }

  it('renders nothing when no block is hovered or selected', () => {
    const ref = setup();
    render(
      <OverlayLayer
        iframeRef={ref}
        blockRects={[{ id: 'a', top: 0, left: 0, width: 10, height: 10 }]}
        hoveredBlockId={null}
        selectedBlockId={null}
      />,
    );

    expect(screen.queryByTestId('overlay-box')).toBeNull();
  });

  it('renders a hovered box positioned relative to the iframe', () => {
    const ref = setup();
    render(
      <OverlayLayer
        iframeRef={ref}
        blockRects={[{ id: 'a', top: 10, left: 20, width: 300, height: 40 }]}
        hoveredBlockId="a"
        selectedBlockId={null}
      />,
    );

    const box = screen.getByTestId('overlay-box');
    expect(box.getAttribute('data-state')).toBe('hovered');
    expect(box.style.top).toBe('110px');
    expect(box.style.left).toBe('70px');
  });

  it('renders a selected box distinctly from a merely hovered one', () => {
    const ref = setup();
    render(
      <OverlayLayer
        iframeRef={ref}
        blockRects={[{ id: 'a', top: 0, left: 0, width: 10, height: 10 }]}
        hoveredBlockId={null}
        selectedBlockId="a"
      />,
    );

    expect(screen.getByTestId('overlay-box').getAttribute('data-state')).toBe(
      'selected',
    );
  });

  it('renders one box per hovered/selected block, skipping inert ones', () => {
    const ref = setup();
    render(
      <OverlayLayer
        iframeRef={ref}
        blockRects={[
          { id: 'a', top: 0, left: 0, width: 10, height: 10 },
          { id: 'b', top: 0, left: 0, width: 10, height: 10 },
          { id: 'c', top: 0, left: 0, width: 10, height: 10 },
        ]}
        hoveredBlockId="b"
        selectedBlockId="c"
      />,
    );

    expect(screen.getAllByTestId('overlay-box')).toHaveLength(2);
  });

  it("hides a selected box whose rect is scrolled below the iframe's own visible viewport", () => {
    // L'iframe misura 600px di altezza (vedi setup()) — un blocco a 900px
    // dal top del SUO documento interno esiste ma non è nella parte
    // visibile senza scorrere l'iframe stesso: senza la guardia aggiunta,
    // l'overlay `position: fixed` finirebbe renderizzato ben oltre il
    // riquadro del canvas, sopra il resto della pagina dell'editor (bug
    // trovato dal vivo popolando un contenitore in fondo a una pagina lunga).
    const ref = setup();
    render(
      <OverlayLayer
        iframeRef={ref}
        blockRects={[{ id: 'a', top: 900, left: 0, width: 300, height: 40 }]}
        hoveredBlockId={null}
        selectedBlockId="a"
      />,
    );

    expect(screen.queryByTestId('overlay-box')).toBeNull();
  });

  it('renders no drop indicator when dropIndicatorTop is not set', () => {
    const ref = setup();
    render(
      <OverlayLayer
        iframeRef={ref}
        blockRects={[]}
        hoveredBlockId={null}
        selectedBlockId={null}
      />,
    );

    expect(screen.queryByTestId('drop-indicator')).toBeNull();
  });

  it('renders the drop indicator at the given position, spanning the iframe width', () => {
    const ref = setup();
    render(
      <OverlayLayer
        iframeRef={ref}
        blockRects={[]}
        hoveredBlockId={null}
        selectedBlockId={null}
        dropIndicatorTop={30}
      />,
    );

    const indicator = screen.getByTestId('drop-indicator');
    expect(indicator.style.top).toBe('129px');
    expect(indicator.style.left).toBe('50px');
    expect(indicator.style.width).toBe('800px');
  });
});
