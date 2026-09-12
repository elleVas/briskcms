import {
  forwardRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { IconButton } from '../icon-button';
import {
  clampPanelWidth,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  readPanelCollapsed,
  readPanelWidth,
  writePanelCollapsed,
  writePanelWidth,
} from './side-panel-preferences';

export interface CollapsibleSidePanelProps {
  /** Which edge of the canvas it sits on — decides the border, the icons, where the toggle aligns and which way a drag widens it. */
  side: 'left' | 'right';
  /** Names the landmark for a screen reader, and heads the panel when it has no header of its own. */
  title: string;
  expandLabel: string;
  collapseLabel: string;
  /** Distinguishes this panel's remembered width and collapsed state from the other's. */
  storageKey: string;
  /** The drag handle's accessible name. */
  resizeLabel: string;
  /** Replaces the plain title — the right panel puts its two tabs here. */
  header?: ReactNode;
  children: ReactNode;
}

/**
 * One of the two panels either side of the canvas — Insert block on the
 * left, Layers and Properties on the right.
 *
 * Both are collapsible, and both now REMEMBER being collapsed and how wide
 * they were left. They used to do neither: a fixed `w-64` and component
 * state that reset on every mount, so on a small screen the canvas stayed
 * narrow and the collapsing had to be redone on every page. The width is
 * what changed the stakes — the right panel holds the selected block's
 * properties now, and a Hero's seven fields need more than 256 pixels.
 *
 * They were the same thirty lines written twice, differing only in which
 * edge they sit on; the resize handle is the same, mirrored.
 */
export const CollapsibleSidePanel = forwardRef<
  HTMLElement,
  CollapsibleSidePanelProps
>(function CollapsibleSidePanel(
  {
    side,
    title,
    expandLabel,
    collapseLabel,
    storageKey,
    resizeLabel,
    header,
    children,
  },
  ref,
) {
  const [isCollapsed, setIsCollapsed] = useState(() =>
    readPanelCollapsed(storageKey),
  );
  const [width, setWidth] = useState(() => readPanelWidth(storageKey));
  // The width at the moment the drag started, plus where the pointer was:
  // reading the panel's live box on every move would feed its own resizing
  // back into the calculation.
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const edge = side === 'left' ? 'border-r' : 'border-l';

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((collapsed) => {
      writePanelCollapsed(storageKey, !collapsed);
      return !collapsed;
    });
  }, [storageKey]);

  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: width };
  }

  function handleResizeMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    // The left panel grows when the pointer goes right, the right panel
    // when it goes left — the handle is always on the canvas side.
    const delta =
      side === 'left'
        ? event.clientX - drag.startX
        : drag.startX - event.clientX;
    setWidth(clampPanelWidth(drag.startWidth + delta));
  }

  function handleResizeEnd(): void {
    if (!dragRef.current) {
      return;
    }
    dragRef.current = null;
    writePanelWidth(storageKey, width);
  }

  /** The keyboard's version of the drag — a resize nobody can reach with Tab is a resize half the people cannot use. */
  function handleResizeKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void {
    const step = event.shiftKey ? 48 : 16;
    const towards = side === 'left' ? 1 : -1;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') {
      next = width + step * towards * -1;
    } else if (event.key === 'ArrowRight') {
      next = width + step * towards;
    }
    if (next === null) {
      return;
    }
    event.preventDefault();
    const clamped = clampPanelWidth(next);
    setWidth(clamped);
    writePanelWidth(storageKey, clamped);
  }

  return (
    <aside
      ref={ref}
      // Named, so the landmark is addressable: a screen reader announces
      // which of the two panels it has entered, and "Text" in the inserter
      // stops being indistinguishable from "Text" in the layers tree.
      aria-label={title}
      tabIndex={-1}
      className={
        isCollapsed
          ? `flex w-10 shrink-0 flex-col items-center ${edge} py-3 outline-none`
          : `relative flex shrink-0 flex-col ${edge} outline-none`
      }
      style={isCollapsed ? undefined : { width }}
    >
      <div
        className={
          isCollapsed
            ? 'contents'
            : `flex min-h-0 flex-1 flex-col overflow-y-auto p-3`
        }
      >
        <IconButton
          label={isCollapsed ? expandLabel : collapseLabel}
          onClick={toggleCollapsed}
          className={
            isCollapsed
              ? undefined
              : side === 'left'
                ? 'mb-2 -ml-1'
                : 'mb-2 -mr-1 self-end'
          }
        >
          {/* Four static elements rather than an icon picked into a variable:
              a component chosen during render trips the React Compiler (see
              block-icons.tsx). */}
          {side === 'left' ? (
            isCollapsed ? (
              <PanelLeftOpen />
            ) : (
              <PanelLeftClose />
            )
          ) : isCollapsed ? (
            <PanelRightOpen />
          ) : (
            <PanelRightClose />
          )}
        </IconButton>
        {!isCollapsed && (
          <>
            {header ?? <h3 className="mb-2 text-sm font-medium">{title}</h3>}
            {children}
          </>
        )}
      </div>
      {!isCollapsed && (
        <div
          role="separator"
          aria-label={resizeLabel}
          aria-orientation="vertical"
          aria-valuenow={width}
          aria-valuemin={MIN_PANEL_WIDTH}
          aria-valuemax={MAX_PANEL_WIDTH}
          tabIndex={0}
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          onKeyDown={handleResizeKeyDown}
          className={`absolute inset-y-0 z-10 w-1.5 cursor-col-resize hover:bg-primary/40 focus-visible:bg-primary/60 focus-visible:outline-none ${
            side === 'left' ? '-right-0.5' : '-left-0.5'
          }`}
        />
      )}
    </aside>
  );
});
