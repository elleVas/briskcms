import { type ReactNode, useState } from 'react';
import {
  ChevronDown,
  Keyboard,
  Palette,
  Redo2,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import type { ResponsiveBlockStyle } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { Button } from '../../components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { useTranslation } from '../../lib/use-translation';
import { GlobalStylesDialog } from '../global-styles-dialog';
import { IconButton } from '../icon-button';
import type { BlockPickerCategory } from './block-picker';
import { BreakpointSelector, type Breakpoint } from './breakpoint-selector';
import { formatShortcut } from './keyboard-shortcuts';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';

/**
 * One entry of the "Page" menu.
 *
 * These used to be six unlabelled icons crowded at the left of the bar —
 * search, classification, history, translations, fork, open page — sitting
 * beside undo and redo with nothing to say that four of them act on the
 * PAGE and two on the CANVAS. A tooltip each is not a hierarchy.
 */
export interface CanvasPageMenuItem {
  /** Stable across renders, and what the reader actually sees. */
  label: string;
  icon: LucideIcon;
  onSelect?: () => void;
  /** For "open the page", which must stay a real link: middle-click, copy address, open in a new tab. */
  href?: string;
}

export interface CanvasTopBarProps {
  backLink: ReactNode;
  pageSwitcher?: ReactNode;
  languageSwitcher?: ReactNode;
  /** What is being edited, in words — the centre of the bar used to hold nothing at all, not even the name of the page. */
  title?: string;
  /**
   * The chain from the outermost ancestor down to the selected block, each
   * step already labelled and each one selectable. It used to be a chip
   * floating over the canvas at the page's top-left, on top of the site's
   * own navigation.
   */
  breadcrumb?: { id: string; label: string }[];
  onSelectBlock?: (blockId: string) => void;
  statusText: string;
  /** Page-level actions, as a labelled menu rather than a row of icons. */
  pageMenu?: CanvasPageMenuItem[];
  /** Anything that genuinely has to stay on the bar — the header editor's "stick while scrolling" is the only one. */
  actions?: ReactNode;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  breakpoint: Breakpoint;
  onBreakpointChange: (breakpoint: Breakpoint) => void;
  /** Present when there is a site to style — every editor that mounts the shell today has one. */
  globalStyles?: {
    siteId: string;
    registry: BlockDescriptor[];
    categories: BlockPickerCategory[];
    onSaveTypeStyle: (
      blockType: string,
      variant: string,
      style: ResponsiveBlockStyle,
    ) => Promise<void>;
  };
  onOpenPreview: () => void;
  onPublish: () => void;
}

function PageMenu({ items }: { items: CanvasPageMenuItem[] }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          {t('canvas.pageMenu.label')}
          <ChevronDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60">
        {items.map(({ label, icon: Icon, onSelect, href }) =>
          href ? (
            <Button
              key={label}
              asChild
              variant="ghost"
              className="w-full justify-start gap-2 px-1 py-1.5 text-sm"
            >
              <a href={href} target="_blank" rel="noopener noreferrer">
                <Icon className="size-4" />
                {label}
              </a>
            </Button>
          ) : (
            <Button
              key={label}
              variant="ghost"
              className="w-full justify-start gap-2 px-1 py-1.5 text-sm"
              onClick={() => {
                setIsOpen(false);
                onSelect?.();
              }}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ),
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The strip above the canvas: where you are and what state the page is in
 * on the left, what you are editing in the middle, and what you can do to
 * the canvas plus the two ways out on the right.
 *
 * It owns the Global styles and Shortcuts dialogs as well as the buttons
 * that open them: nothing else in the editor opens either, so their open
 * state has no business living anywhere else.
 */
export function CanvasTopBar({
  backLink,
  pageSwitcher,
  languageSwitcher,
  title,
  breadcrumb = [],
  onSelectBlock,
  statusText,
  pageMenu,
  actions,
  undo,
  redo,
  canUndo,
  canRedo,
  breakpoint,
  onBreakpointChange,
  globalStyles,
  onOpenPreview,
  onPublish,
}: CanvasTopBarProps) {
  const { t } = useTranslation();
  const [isGlobalStylesOpen, setIsGlobalStylesOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  return (
    <>
      {/* 44px rather than the 45 it measured: the chrome sits on a
          four-pixel grid now, like everything else the shell draws. */}
      <div className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-3 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          {backLink}
          {pageSwitcher}
          {languageSwitcher}
          {pageMenu && pageMenu.length > 0 && <PageMenu items={pageMenu} />}
          {actions}
          <span className="truncate">{statusText}</span>
        </div>
        {/*
          The middle of the bar was empty. What is being edited lives here
          now — the page's name, and the trail down to the selected block,
          which used to be a chip drawn over the site's own navigation
          inside the canvas. Every step but the last selects that ancestor:
          a block inside a Column inside a Columns is otherwise unreachable
          except by hunting for a pixel its children do not already cover.
        */}
        <div className="flex min-w-0 items-center justify-center gap-1">
          {title && (
            <span className="truncate font-medium text-foreground">
              {title}
            </span>
          )}
          {breadcrumb.map((step, index) => (
            <span key={step.id} className="flex min-w-0 items-center gap-1">
              <span aria-hidden="true">›</span>
              {index === breadcrumb.length - 1 ? (
                // The selected block itself: a label, not a button —
                // clicking it would select what is already selected.
                <span
                  data-testid="block-breadcrumb"
                  className="truncate font-medium text-foreground"
                >
                  {step.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="truncate underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => onSelectBlock?.(step.id)}
                >
                  {step.label}
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-end gap-1">
          <IconButton
            label={t('canvas.undo')}
            shortcut={formatShortcut(['mod', 'Z'])}
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo2 />
          </IconButton>
          <IconButton
            label={t('canvas.redo')}
            shortcut={formatShortcut(['mod', '⇧', 'Z'])}
            onClick={redo}
            disabled={!canRedo}
          >
            <Redo2 />
          </IconButton>
          <BreakpointSelector
            value={breakpoint}
            onChange={onBreakpointChange}
          />
          {globalStyles && (
            <IconButton
              label={t('globalStyles.open')}
              onClick={() => setIsGlobalStylesOpen(true)}
            >
              <Palette />
            </IconButton>
          )}
          <IconButton
            label={t('canvas.shortcuts.open')}
            onClick={() => setIsShortcutsOpen(true)}
          >
            <Keyboard />
          </IconButton>
          {/* The two most important buttons in the app were the smallest in
              the app: `size="sm"`, 28px tall with 12.8px text. */}
          <Button variant="outline" onClick={onOpenPreview}>
            {t('canvas.preview')}
          </Button>
          <Button onClick={onPublish}>{t('canvas.publish')}</Button>
        </div>
      </div>
      {globalStyles && (
        <GlobalStylesDialog
          siteId={globalStyles.siteId}
          open={isGlobalStylesOpen}
          onOpenChange={setIsGlobalStylesOpen}
          registry={globalStyles.registry}
          categories={globalStyles.categories}
          onSaveTypeStyle={globalStyles.onSaveTypeStyle}
        />
      )}
      <KeyboardShortcutsDialog
        open={isShortcutsOpen}
        onOpenChange={setIsShortcutsOpen}
      />
    </>
  );
}
