import { type KeyboardEvent as ReactKeyboardEvent, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/use-translation';

export type RightPanelTab = 'layers' | 'properties';

/** The two tabs, in the order they are drawn — and the order the arrow keys move through. */
export const RIGHT_PANEL_TABS: readonly RightPanelTab[] = [
  'layers',
  'properties',
];

/** Shared by the tab and its panel, so `aria-controls` and `aria-labelledby` point at something real. */
export function rightPanelTabId(tab: RightPanelTab): string {
  return `canvas-right-panel-tab-${tab}`;
}

export function rightPanelId(tab: RightPanelTab): string {
  return `canvas-right-panel-${tab}`;
}

export interface RightPanelTabsProps {
  value: RightPanelTab;
  onChange: (tab: RightPanelTab) => void;
}

/**
 * Layers and Properties, as a real tab strip.
 *
 * A roving tabindex and the arrow keys, because that is what a tablist is:
 * Tab moves INTO the strip and then into the panel it controls, and the
 * arrows move between the tabs. Two buttons with `role="tab"` and nothing
 * else is a tab strip a keyboard cannot drive.
 */
export function RightPanelTabs({ value, onChange }: RightPanelTabsProps) {
  const { t } = useTranslation();
  const stripRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const current = RIGHT_PANEL_TABS.indexOf(value);
    let next: number | null = null;
    if (event.key === 'ArrowRight') {
      next = (current + 1) % RIGHT_PANEL_TABS.length;
    } else if (event.key === 'ArrowLeft') {
      next = (current - 1 + RIGHT_PANEL_TABS.length) % RIGHT_PANEL_TABS.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = RIGHT_PANEL_TABS.length - 1;
    }
    if (next === null) {
      return;
    }
    event.preventDefault();
    const tab = RIGHT_PANEL_TABS[next];
    onChange(tab);
    // Follow-focus, the pattern for a tablist that activates on arrow:
    // the keyboard has to end up on the tab it just moved to, or the next
    // arrow press starts over from wherever it was.
    stripRef.current
      ?.querySelector<HTMLButtonElement>(`#${rightPanelTabId(tab)}`)
      ?.focus();
  }

  return (
    <div
      ref={stripRef}
      role="tablist"
      aria-label={t('canvas.rightPanel.label')}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className="mb-2 flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5"
    >
      {RIGHT_PANEL_TABS.map((tab) => {
        const isSelected = value === tab;
        return (
          <button
            key={tab}
            id={rightPanelTabId(tab)}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={rightPanelId(tab)}
            // Roving: only the selected tab is in the tab order, so Tab
            // steps past the strip in one press rather than through it.
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(tab)}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected && 'bg-background text-foreground',
            )}
          >
            {t(`canvas.rightPanel.${tab}`)}
          </button>
        );
      })}
    </div>
  );
}
