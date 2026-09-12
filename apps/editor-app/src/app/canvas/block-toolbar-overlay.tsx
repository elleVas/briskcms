import { useState, type RefObject } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Rows3,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { BlockRect } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { useTranslation } from '../../lib/use-translation';
import { BlockPicker, type BlockPickerCategory } from './block-picker';
import {
  toAddChildStyle,
  toInsertPointStyle,
  toToolbarStyle,
  useIframeGeometry,
} from './overlay-layer';

export interface BlockToolbarOverlayProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  descriptor: BlockDescriptor;
  rect: BlockRect;
  /** True only for a top-level block — it governs insert-sibling (scoped to that level, like drag reordering, see compute-drop-target.ts). NOT move up/down: that works at any depth, see canMoveUp/canMoveDown. */
  isRootLevel: boolean;
  /** True at ANY depth — computed from the block's real position among its siblings (root or nested), not from the root level alone. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  registry: BlockDescriptor[];
  categories: BlockPickerCategory[];
  /**
   * Puts the keyboard in the properties panel, which is a tab of the right
   * panel since the popover was retired. The button used to OPEN the panel
   * over the canvas; now the panel is always there and this is how you
   * reach it without the mouse.
   */
  onFocusProperties?: () => void;
  /**
   * Turns this block into a reusable section and replaces it with an
   * instance (docs/adr/0059). Absent where that has no meaning: inside the
   * section editor, and in the header/footer.
   */
  onMakeReusable?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onInsertBefore: (descriptor: BlockDescriptor) => void;
  onInsertAfter: (descriptor: BlockDescriptor) => void;
  /** Present only for a "collection" container (a single type in `allowedChildTypes`, e.g. Testimonials→Testimonial) — it adds another child of that type directly, with no picker: the only sensible type is already known. */
  onAddChild?: () => void;
}

/**
 * One button of the floating toolbar.
 *
 * It used to sit on `bg-background` — the colour of the PAGE behind it —
 * with a 4px radius and muted icons, so on a light site it read as a black
 * slab dropped on the content rather than as a control hovering over it. It
 * is an elevated surface now: the popover colour, the radius the rest of
 * the app uses, a real shadow, and icons at full strength.
 */
const iconButtonClass =
  'flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40';

/** Separates the groups — move, edit, duplicate/delete — which were one undifferentiated column of six icons. */
function ToolbarSeparator() {
  return <span aria-hidden className="mx-1 h-px bg-border" />;
}

/**
 * The contextual toolbar anchored to the selected block: move up and down,
 * a way into the properties, make reusable, duplicate, delete, and
 * insertion points above and below. The same iframe-offset translation
 * OverlayLayer already uses for hover/selection — no new positioning maths.
 *
 * What it no longer carries is the properties themselves. They hung off the
 * pencil as a 416px `Popover` that opened over the canvas and covered both
 * the block being edited and the top bar; they are a tab of the right panel
 * now (see properties-panel.tsx), and the breadcrumb that used to float as
 * a chip over the site's own navigation is in the top bar, where there was
 * nothing at all — not even the name of the page.
 */
export function BlockToolbarOverlay({
  iframeRef,
  descriptor,
  rect,
  isRootLevel,
  canMoveUp,
  canMoveDown,
  registry,
  categories,
  onFocusProperties,
  onMakeReusable,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onInsertBefore,
  onInsertAfter,
  onAddChild,
}: BlockToolbarOverlayProps) {
  const { t } = useTranslation();
  const geometry = useIframeGeometry(iframeRef);
  const [insertOpen, setInsertOpen] = useState<'before' | 'after' | null>(null);

  const canAddChild =
    descriptor.isContainer && descriptor.allowedChildTypes?.length === 1;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {isRootLevel && (
        <Popover
          open={insertOpen === 'before'}
          onOpenChange={(open) => setInsertOpen(open ? 'before' : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
              style={toInsertPointStyle(geometry, rect, 'top')}
              aria-label={t('canvas.insertBlock')}
            >
              <Plus size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent>
            <BlockPicker
              categories={categories}
              registry={registry}
              onInsert={(picked) => {
                onInsertBefore(picked);
                setInsertOpen(null);
              }}
            />
          </PopoverContent>
        </Popover>
      )}

      <div
        className="pointer-events-auto flex flex-col gap-0.5 rounded-md border bg-popover p-1 shadow-md"
        style={toToolbarStyle(geometry, rect)}
      >
        <button
          type="button"
          className={iconButtonClass}
          disabled={!canMoveUp}
          onClick={onMoveUp}
          aria-label={t('canvas.moveUp')}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          className={iconButtonClass}
          disabled={!canMoveDown}
          onClick={onMoveDown}
          aria-label={t('canvas.moveDown')}
        >
          <ChevronDown size={16} />
        </button>
        {/* The per-TYPE style used to sit here, behind a brush. It edits
            `site.themeTokens.blockStyles[type]` — every block of that type
            on the whole site — from a toolbar whose every other control
            acts on this one block, which is a control that looks local and
            is not. It is not lost: the Style screen edits exactly the same
            values, for every type, with its own breakpoint selector. */}
        {/* Always offered. The old popover hid this button when the block
            had no fields, no looks and nothing stylable — it would have
            opened an empty box. The Properties tab exists whatever is
            selected, so there is always somewhere for this to take you. */}
        {onFocusProperties && (
          <>
            <ToolbarSeparator />
            <button
              type="button"
              className={iconButtonClass}
              onClick={onFocusProperties}
              aria-label={t('canvas.editProperties')}
            >
              <Pencil size={16} />
            </button>
          </>
        )}
        {/* Only where it can actually be honoured: a section is placed on
            a page, so turning a block into one has no meaning inside the
            section editor itself, nor in the header/footer (docs/adr/0059). */}
        {onMakeReusable && (
          <button
            type="button"
            className={iconButtonClass}
            onClick={onMakeReusable}
            aria-label={t('sections.makeReusable')}
          >
            <Rows3 size={16} />
          </button>
        )}
        <ToolbarSeparator />
        <button
          type="button"
          className={iconButtonClass}
          onClick={onDuplicate}
          aria-label={t('canvas.duplicateBlock')}
        >
          <Copy size={16} />
        </button>
        <button
          type="button"
          className={
            iconButtonClass +
            ' text-destructive hover:bg-destructive/10 hover:text-destructive'
          }
          onClick={onDelete}
          aria-label={t('canvas.removeBlock')}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {isRootLevel && (
        <Popover
          open={insertOpen === 'after'}
          onOpenChange={(open) => setInsertOpen(open ? 'after' : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
              style={toInsertPointStyle(geometry, rect, 'bottom')}
              aria-label={t('canvas.insertBlock')}
            >
              <Plus size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent>
            <BlockPicker
              categories={categories}
              registry={registry}
              onInsert={(picked) => {
                onInsertAfter(picked);
                setInsertOpen(null);
              }}
            />
          </PopoverContent>
        </Popover>
      )}

      {canAddChild && onAddChild && (
        <button
          type="button"
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
          style={toAddChildStyle(geometry, rect)}
          onClick={onAddChild}
          aria-label={t('canvas.addChild')}
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}
