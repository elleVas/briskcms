import { type ReactNode, useState } from 'react';
import { Palette, Redo2, Undo2 } from 'lucide-react';
import type { ResponsiveBlockStyle } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { Button } from '../../components/ui/button';
import { useTranslation } from '../../lib/use-translation';
import { GlobalStylesDialog } from '../global-styles-dialog';
import { IconButton } from '../icon-button';
import type { BlockPickerCategory } from './block-picker';
import { BreakpointSelector, type Breakpoint } from './breakpoint-selector';

export interface CanvasTopBarProps {
  backLink: ReactNode;
  pageSwitcher?: ReactNode;
  languageSwitcher?: ReactNode;
  statusText: string;
  actions?: ReactNode;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  breakpoint: Breakpoint;
  onBreakpointChange: (breakpoint: Breakpoint) => void;
  /** Present when there is a site to style — both the page editor and the header/footer editor have one; the section editor does not. */
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

/**
 * The strip above the canvas: where you are and what state the page is in
 * on the left, what you can do to the whole page in the middle, and the
 * two ways out — preview and publish — on the right.
 *
 * It owns the Global styles dialog as well as the button that opens it:
 * nothing else in the editor opens that dialog, so its open state has no
 * business living anywhere else.
 */
export function CanvasTopBar({
  backLink,
  pageSwitcher,
  languageSwitcher,
  statusText,
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

  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-3 py-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {backLink}
          {pageSwitcher}
          {languageSwitcher}
          <span>{statusText}</span>
          {actions}
        </div>
        <div className="flex items-center justify-center gap-2">
          <IconButton
            label={t('canvas.undo')}
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo2 />
          </IconButton>
          <IconButton
            label={t('canvas.redo')}
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
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onOpenPreview}>
            {t('canvas.preview')}
          </Button>
          <Button size="sm" onClick={onPublish}>
            {t('canvas.publish')}
          </Button>
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
    </>
  );
}
