import { type ReactNode, useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { IconButton } from '../icon-button';

export interface CollapsibleSidePanelProps {
  /** Which edge of the canvas it sits on — decides the border, the icons and where the toggle aligns. */
  side: 'left' | 'right';
  title: string;
  expandLabel: string;
  collapseLabel: string;
  children: ReactNode;
}

/**
 * One of the two panels either side of the canvas — Insert block on the
 * left, Layers on the right.
 *
 * Asked for from live use: on a long page with many blocks, collapsing
 * either one gives the canvas more room. Each keeps its own state, neither
 * is persisted, and both start open on a new mount, like the breakpoint.
 * They were the same thirty lines written twice, differing only in which
 * edge they sit on.
 */
export function CollapsibleSidePanel({
  side,
  title,
  expandLabel,
  collapseLabel,
  children,
}: CollapsibleSidePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const edge = side === 'left' ? 'border-r' : 'border-l';

  return (
    <aside
      // Named, so the landmark is addressable: a screen reader announces
      // which of the two panels it has entered, and "Text" in the inserter
      // stops being indistinguishable from "Text" in the layers tree.
      aria-label={title}
      className={
        isCollapsed
          ? `flex w-10 shrink-0 flex-col items-center ${edge} py-3`
          : `w-64 shrink-0 overflow-y-auto ${edge} p-3`
      }
    >
      <IconButton
        label={isCollapsed ? expandLabel : collapseLabel}
        onClick={() => setIsCollapsed((collapsed) => !collapsed)}
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
          <h3 className="mb-2 text-sm font-medium">{title}</h3>
          {children}
        </>
      )}
    </aside>
  );
}
