import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import type { BlockRect } from '@brisk/shared-types';

export interface OverlayLayerProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  blockRects: BlockRect[];
  hoveredBlockId: string | null;
  selectedBlockId: string | null;
  /** The Y (iframe-relative, see compute-drop-target.ts) at which to draw the drop line during a direct canvas reorder — `null`/absent when no drag is in progress. */
  dropIndicatorTop?: number | null;
}

export interface IframeGeometry {
  top: number;
  left: number;
  width: number;
  height: number;
}

const ZERO_GEOMETRY: IframeGeometry = { top: 0, left: 0, width: 0, height: 0 };

/**
 * `rect` is viewport-relative INSIDE the iframe (the same coordinate system
 * `getBoundingClientRect()` uses in there) — it stays valid even when the
 * block is scrolled out of the iframe's visible area (a long page scrolls
 * INSIDE the iframe itself, which has a fixed height, see canvas-frame.tsx).
 * Without this check, a `position: fixed` overlay (the selection border, the
 * drop indicator, or the whole contextual toolbar) for such a block ended up
 * rendered outside the canvas frame, on top of the rest of the editor's page
 * — a bug found live while filling a container at the bottom of a long page:
 * the "Add element" button appeared detached, far from the container it
 * belonged to.
 *
 * A `geometry` still at `ZERO_GEOMETRY` (never measured — on the first
 * render, before `useIframeGeometry` finds the iframe in the DOM, or in
 * jsdom tests that do not mock `getBoundingClientRect`) is treated as
 * "visibility unknown" and always passes: a false negative here (hiding the
 * toolbar when the iframe is in fact full-size but not yet measured) would
 * be worse than the opposite false positive.
 */
export function isRectVisibleInIframe(
  geometry: IframeGeometry,
  rect: { top: number; left: number; width: number; height: number },
): boolean {
  if (geometry.width === 0 && geometry.height === 0) {
    return true;
  }
  return (
    rect.top + rect.height > 0 &&
    rect.top < geometry.height &&
    rect.left + rect.width > 0 &&
    rect.left < geometry.width
  );
}

/**
 * Every `BlockRect` arrives viewport-relative to the DOCUMENT INSIDE the
 * iframe (the same semantics as `getBoundingClientRect()`, see
 * apps/public-site/src/lib/get-block-rect.ts) — it has to be added to the
 * iframe's own position in the parent page to draw the overlay in the right
 * place.
 */
/**
 * `position: 'fixed'`, not `'absolute'` — the overlay lives inside a
 * container that is itself already co-located with the iframe's box (no
 * padding or margin between the two), so an `absolute` would add the
 * iframe's offset a second time on top of the one the positioned parent
 * already gives. `fixed` ignores the ancestor hierarchy and uses
 * `geometry`/`rect`'s viewport coordinates directly (the same semantics as
 * `getBoundingClientRect()`), which is the only thing that makes the
 * translation below correct.
 */
export function toOverlayStyle(
  geometry: IframeGeometry,
  rect: BlockRect,
): CSSProperties {
  return {
    position: 'fixed',
    top: geometry.top + rect.top,
    left: geometry.left + rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/** The same translation as `toOverlayStyle` but for a horizontal line spanning the iframe's full width rather than a box — the drop indicator for direct canvas reordering. */
export function toDropIndicatorStyle(
  geometry: IframeGeometry,
  top: number,
): CSSProperties {
  return {
    position: 'fixed',
    top: geometry.top + top - 1,
    left: geometry.left,
    width: geometry.width,
    height: 2,
  };
}

/**
 * The four functions below come from `block-toolbar-overlay.tsx` (the
 * selected block's contextual toolbar) — moved here because they are pure
 * and do exactly the same kind of geometry+rect->CSSProperties translation
 * as `toOverlayStyle`/`toDropIndicatorStyle` above, not because they
 * conceptually belong to "OverlayLayer": the same "pure positioning maths
 * next to useIframeGeometry" co-location, not a new invention for these
 * four.
 */

/**
 * `position: 'fixed'` — the toolbar lives inside a container
 * (canvas-editor-shell.tsx) that is itself already co-located with the
 * iframe's box, so an `absolute` would add the iframe's offset a second
 * time on top of the one the positioned parent already gives. `fixed`
 * ignores the ancestor hierarchy and uses `geometry`/`rect`'s viewport
 * coordinates directly (the same semantics as `getBoundingClientRect()`,
 * see `useIframeGeometry`), which is the only thing that makes this
 * translation correct.
 */
export function toPillStyle(
  geometry: IframeGeometry,
  rect: BlockRect,
): CSSProperties {
  return {
    position: 'fixed',
    top: geometry.top + rect.top - 28,
    left: geometry.left + rect.left,
  };
}

/** An approximate width for the icon column (a 28px button plus padding/border) — used only to decide whether there is room to the right of the block, never for real layout. */
const TOOLBAR_WIDTH_PX = 40;
const TOOLBAR_GAP_PX = 8;

/**
 * For a full-width block (the common case for top-level blocks) placing it
 * at `rect.left + rect.width + 8` would push it outside the iframe — it is
 * clamped here to the iframe's own right edge, which for a full-width block
 * coincides with the block's right edge.
 */
export function toToolbarStyle(
  geometry: IframeGeometry,
  rect: BlockRect,
): CSSProperties {
  const preferredLeft = geometry.left + rect.left + rect.width + TOOLBAR_GAP_PX;
  const maxLeft =
    geometry.left + geometry.width - TOOLBAR_WIDTH_PX - TOOLBAR_GAP_PX;
  return {
    position: 'fixed',
    top: geometry.top + rect.top,
    left: Math.min(preferredLeft, maxLeft),
  };
}

export function toInsertPointStyle(
  geometry: IframeGeometry,
  rect: BlockRect,
  edge: 'top' | 'bottom',
): CSSProperties {
  return {
    position: 'fixed',
    top:
      geometry.top + (edge === 'top' ? rect.top : rect.top + rect.height) - 12,
    left: geometry.left + rect.left + rect.width / 2 - 12,
  };
}

/**
 * Unlike `toInsertPointStyle` (which STRADDLES the block's edge, for a
 * page-level sibling — and for a top-level block appears right on the
 * BOTTOM edge), this one stays INSIDE the container's own rectangle, in the
 * top-right corner: visually "add in here", not "insert a sibling
 * elsewhere". Centred on the right edge (rather than in the corner) it
 * almost always ended up overlapping Testimonials' navigation buttons
 * (which are vertically centred there too); on the bottom edge it
 * overlapped a top-level block's root "+" instead — both observed live.
 */
export function toAddChildStyle(
  geometry: IframeGeometry,
  rect: BlockRect,
): CSSProperties {
  return {
    position: 'fixed',
    top: geometry.top + rect.top + 4,
    left: geometry.left + rect.left + rect.width - 32,
  };
}

/**
 * Recomputes the iframe's position and width within the parent's document
 * on every resize/scroll — otherwise the overlay drifts whenever the
 * parent's own page scrolls. Exported: `block-toolbar-overlay.tsx` shares
 * it rather than recomputing the same thing a second time.
 */
export function useIframeGeometry(
  iframeRef: RefObject<HTMLIFrameElement | null>,
): IframeGeometry {
  const [geometry, setGeometry] = useState<IframeGeometry>(ZERO_GEOMETRY);

  useEffect(() => {
    let resizeObserver: ResizeObserver | undefined;
    let rafId: number | undefined;

    function recompute(): void {
      const rect = iframeRef.current?.getBoundingClientRect();
      if (rect) {
        setGeometry({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    }

    /**
     * CanvasFrame mounts the `<iframe>` only after the preview token
     * arrives (async) — on this effect's first run `iframeRef.current` is
     * almost always still `null`. Without this retry `recompute()` would
     * find nothing and stay stuck on ZERO_GEOMETRY forever (the
     * resize/scroll listeners alone never notice, because neither fires
     * when the iframe appears later).
     */
    function attach(): void {
      const el = iframeRef.current;
      if (!el) {
        rafId = requestAnimationFrame(attach);
        return;
      }
      recompute();
      resizeObserver = new ResizeObserver(recompute);
      resizeObserver.observe(el);
    }

    attach();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [iframeRef]);

  return geometry;
}

/**
 * Draws the hover/selection box on top of the iframe — read-only for now
 * (Day 2): no interaction of its own, it just shows the state arriving from
 * the bridge (usePreviewBridge). `pointer-events-none` on the container
 * lets every real click and hover through to the iframe underneath.
 */
export function OverlayLayer({
  iframeRef,
  blockRects,
  hoveredBlockId,
  selectedBlockId,
  dropIndicatorTop,
}: OverlayLayerProps) {
  const geometry = useIframeGeometry(iframeRef);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {blockRects.map((rect) => {
        const isSelected = rect.id === selectedBlockId;
        const isHovered = rect.id === hoveredBlockId;
        if (!isSelected && !isHovered) {
          return null;
        }
        if (!isRectVisibleInIframe(geometry, rect)) {
          return null;
        }
        return (
          <div
            key={rect.id}
            data-testid="overlay-box"
            data-block-id={rect.id}
            data-state={isSelected ? 'selected' : 'hovered'}
            className={
              isSelected
                ? 'absolute rounded-sm border-2 border-primary'
                : 'absolute rounded-sm border-2 border-primary/50'
            }
            style={toOverlayStyle(geometry, rect)}
          />
        );
      })}
      {dropIndicatorTop != null && (
        <div
          data-testid="drop-indicator"
          className="absolute rounded-full bg-primary"
          style={toDropIndicatorStyle(geometry, dropIndicatorTop)}
        />
      )}
    </div>
  );
}
