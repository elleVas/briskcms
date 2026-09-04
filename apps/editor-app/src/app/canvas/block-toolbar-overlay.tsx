import { useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Paintbrush,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  Block,
  BlockRect,
  BlockStyleDefaults,
  BlockStyleOverride,
} from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { blockStyleDefaultsQueryOptions } from '../block-style-defaults-queries';
import { useActiveThemeName } from '../use-active-theme-name';
import { useTranslation } from '../../lib/use-translation';
import { BlockPicker, type BlockPickerCategory } from './block-picker';
import { BlockStyleFields } from './block-style-fields';
import { InspectorPanel } from './inspector-panel';
import {
  toAddChildStyle,
  toInsertPointStyle,
  toPillStyle,
  toToolbarStyle,
  useIframeGeometry,
} from './overlay-layer';

export interface BlockToolbarOverlayProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  block: Block;
  descriptor: BlockDescriptor;
  rect: BlockRect;
  /** True only for a top-level block — it governs insert-sibling (scoped to that level, like drag reordering, see compute-drop-target.ts) and the spacing fields (marginTop/marginBottom). NOT move up/down: that works at any depth, see canMoveUp/canMoveDown. */
  isRootLevel: boolean;
  /** True at ANY depth — computed from the block's real position among its siblings (root or nested), not from the root level alone. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  registry: BlockDescriptor[];
  categories: BlockPickerCategory[];
  onChangeProp: (key: string, value: unknown) => void;
  /**
   * The "component-level" override (docs/adr/0022) — the current value for
   * the selected block's TYPE (`site.themeTokens.blockStyles[type] ?? {}`),
   * touching EVERY instance of that type across the site. Both are absent
   * when there is no site to read it from yet (the query has not arrived,
   * or there is no `siteId` — see canvas-editor-shell.tsx): the "Style"
   * button simply does not appear until they are.
   */
  typeStyle?: BlockStyleOverride;
  onChangeTypeStyle?: (style: BlockStyleOverride) => void;
  /** The per-INSTANCE override (docs/adr/0022) — `block` itself only, read straight from `block.styleOverride` (no separate prop needed). */
  onChangeInstanceStyle: (style: BlockStyleOverride) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onInsertBefore: (descriptor: BlockDescriptor) => void;
  onInsertAfter: (descriptor: BlockDescriptor) => void;
  /** Present only for a "collection" container (a single type in `allowedChildTypes`, e.g. Testimonials→Testimonial) — it adds another child of that type directly, with no picker: the only sensible type is already known. */
  onAddChild?: () => void;
}

const iconButtonClass =
  'flex h-7 w-7 items-center justify-center rounded border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40';

/**
 * The contextual toolbar anchored to the selected block (phase 1 of the
 * "visual editor, part 2" plan) — it replaces the fixed Inspector column:
 * breadcrumb, move up/down, colour shortcut, properties through a popover,
 * duplicate, delete, and insertion points above and below. The same
 * iframe-offset translation OverlayLayer already uses for hover/selection —
 * no new positioning maths.
 */
export function BlockToolbarOverlay({
  iframeRef,
  block,
  descriptor,
  rect,
  isRootLevel,
  canMoveUp,
  canMoveDown,
  registry,
  categories,
  onChangeProp,
  typeStyle,
  onChangeTypeStyle,
  onChangeInstanceStyle,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onInsertBefore,
  onInsertAfter,
  onAddChild,
}: BlockToolbarOverlayProps) {
  const { t, tLabel } = useTranslation();
  const geometry = useIframeGeometry(iframeRef);
  const [insertOpen, setInsertOpen] = useState<'before' | 'after' | null>(null);
  const { data: blockStyleDefaults } = useQuery(
    blockStyleDefaultsQueryOptions(useActiveThemeName()),
  );

  const canAddChild =
    descriptor.isContainer && descriptor.allowedChildTypes?.length === 1;
  const stylableProperties = descriptor.stylableProperties ?? [];
  const canStyleType =
    stylableProperties.length > 0 &&
    typeStyle !== undefined &&
    onChangeTypeStyle !== undefined;
  // marginTop/marginBottom are per-INSTANCE only (never per-type, see the
  // comment on blockStyleOverrideSchema in site-theme-tokens.ts) and only
  // for a top-level block: they are the one place where
  // PublicPageContent.astro reads `styleOverride.marginTop/marginBottom`
  // for the space between blocks — on a nested block they would have no
  // visual effect at all, so we do not offer them there. That is why the
  // set of properties shown in the instance popover can differ from the
  // type popover's, which always stays `stylableProperties`.
  const instanceStylableProperties: readonly (keyof BlockStyleOverride)[] =
    isRootLevel
      ? [...stylableProperties, 'marginTop', 'marginBottom']
      : stylableProperties;
  const canStyleInstance = instanceStylableProperties.length > 0;
  // The TYPE override (when present and non-null, i.e. genuinely
  // customized) beats the theme default as the preview for the instance
  // popover: it is what the instance is actually showing until it is
  // restyled at instance level too — not the "raw" theme default, which is
  // misleading once the type has already been restyled. `typeStyle` may
  // hold `null` (a property explicitly not customized), which makes no
  // sense to propagate here — BlockStyleDefaults is not nullable.
  const instanceStyleDefaults: BlockStyleDefaults = {
    ...blockStyleDefaults?.[block.type],
    ...Object.fromEntries(
      Object.entries(typeStyle ?? {}).filter(([, v]) => v != null),
    ),
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <div
        data-testid="block-breadcrumb"
        className="pointer-events-auto flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow-sm"
        style={toPillStyle(geometry, rect)}
      >
        {tLabel(descriptor.label)}
      </div>

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
        className="pointer-events-auto flex flex-col gap-1 rounded border bg-background p-1 shadow-md"
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
        {canStyleType && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={iconButtonClass}
                aria-label={t('canvas.style.editType', {
                  type: tLabel(descriptor.label),
                })}
              >
                <Paintbrush size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right">
              <p className="mb-3 text-xs text-muted-foreground">
                {t('canvas.style.editTypeHint', {
                  type: tLabel(descriptor.label),
                })}
              </p>
              <BlockStyleFields
                properties={stylableProperties}
                value={typeStyle ?? {}}
                onChange={(next) => onChangeTypeStyle?.(next)}
                defaults={blockStyleDefaults?.[block.type]}
              />
            </PopoverContent>
          </Popover>
        )}
        {canStyleInstance && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={iconButtonClass}
                aria-label={t('canvas.style.editInstance')}
              >
                <Palette size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right">
              <BlockStyleFields
                properties={instanceStylableProperties}
                value={block.styleOverride ?? {}}
                onChange={onChangeInstanceStyle}
                defaults={instanceStyleDefaults}
              />
            </PopoverContent>
          </Popover>
        )}
        {descriptor.fields.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={iconButtonClass}
                aria-label={t('canvas.editProperties')}
              >
                <Pencil size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              className="w-104 max-h-[min(32rem,80vh)] overflow-y-auto"
            >
              <InspectorPanel
                block={block}
                descriptor={descriptor}
                onChangeProp={onChangeProp}
              />
            </PopoverContent>
          </Popover>
        )}
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
            iconButtonClass + ' text-destructive hover:text-destructive'
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
