import { useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Rows3,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  Block,
  BlockAlign,
  BlockRect,
  BlockStyleDefaults,
  BlockStyleOverride,
  ResponsiveBlockStyle,
  StyleBreakpoint,
} from '@brisk/shared-types';
import type {
  BlockDescriptor,
  BlockStylePropertyName,
} from '@brisk/block-registry';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { blockStyleDefaultsQueryOptions } from '../block-style-defaults-queries';
import { themeBaseTokensQueryOptions } from '../theme-base-tokens-queries';
import { useActiveThemeName } from '../use-active-theme-name';
import { useTranslation } from '../../lib/use-translation';
import { BlockPicker, type BlockPickerCategory } from './block-picker';
import { BlockStyleFields } from './block-style-fields';
import { InspectorPanel } from './inspector-panel';
import {
  themeAllowsStyleOverrides,
  themeCapabilitiesQueryOptions,
} from '../theme-capabilities-queries';
import { themeStylePropertiesQueryOptions } from '../theme-style-properties-queries';
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
  typeStyle?: ResponsiveBlockStyle;
  /**
   * Which size the style fields edit — the breakpoint selector's current
   * value (ADR-0047). The fields themselves stay flat: this picks the
   * bucket they are handed and the one the change is merged back into.
   */
  breakpoint: StyleBreakpoint;
  /** The per-INSTANCE override (docs/adr/0022) — `block` itself only, read straight from `block.styleOverride` (no separate prop needed). */
  onChangeInstanceStyle: (style: BlockStyleOverride) => void;
  /** Picking one of the type's declared looks (ADR-0047) — `undefined` restores the type's default. */
  onChangeVariant: (variant: string | undefined) => void;
  /** How much page width this block claims (ADR-0049) — present only for a ROOT-level block, see InspectorPanel. */
  onChangeAlign?: (align: BlockAlign | undefined) => void;
  /**
   * The chain from the outermost ancestor down to this block, each step
   * already labelled — the toolbar shows it and lets a person climb it.
   * Empty falls back to the block's own label.
   */
  ancestry?: { id: string; label: string }[];
  /** Selects an ancestor from the breadcrumb. */
  onSelectBlock?: (blockId: string) => void;
  /** Section editor only — see InspectorPanel's own prop (docs/adr/0059). */
  sectionEditing?: { exposed: string[]; onToggle: (field: string) => void };
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
 * What the fields show as the value a property FALLS BACK TO when left
 * empty.
 *
 * At the base size that is the theme's resolved default. At tablet or
 * mobile it is the base override where one is set, because that is what
 * the block will actually look like there — showing the theme default
 * would tell the reader the block is untouched at that size when it is
 * in fact inheriting a value they themselves set, and the difference is
 * invisible until the page is published.
 */
function styleFieldDefaults(
  themeDefaults: BlockStyleDefaults | undefined,
  style: ResponsiveBlockStyle | undefined,
): BlockStyleDefaults | undefined {
  const base = style?.base;
  if (!base || !themeDefaults) {
    return themeDefaults;
  }
  const inherited = Object.fromEntries(
    Object.entries(base).filter(([, value]) => typeof value === 'string'),
  );
  return { ...themeDefaults, ...inherited };
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
  breakpoint,
  typeStyle,
  onChangeInstanceStyle,
  onChangeVariant,
  onChangeAlign,
  sectionEditing,
  ancestry = [],
  onSelectBlock,
  onMakeReusable,
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
  // Hoisted rather than called inside each query's options: three
  // separate `useActiveThemeName()` calls read the same value, and one
  // name makes it obvious they are meant to.
  const activeThemeName = useActiveThemeName();
  const { data: blockStyleDefaults } = useQuery(
    blockStyleDefaultsQueryOptions(activeThemeName),
  );
  // The theme's own colours, offered as swatches by every colour control
  // below (ADR-0050) — loaded here rather than passed down, like the two
  // theme queries either side of it. Cached per theme name and never
  // refetched, so the extra query costs nothing per block selection.
  const { data: themeTokens } = useQuery(
    themeBaseTokensQueryOptions(activeThemeName),
  );

  const canAddChild =
    descriptor.isContainer && descriptor.allowedChildTypes?.length === 1;
  // What the active theme lets this site put on top of it
  // (docs/adr/0021's ceiling). A theme that refuses is refusing every
  // tier, so neither styling button appears — before this, both did, saved
  // what you chose, and the published page ignored it.
  const { data: themeCapabilities } = useQuery(
    themeCapabilitiesQueryOptions(activeThemeName),
  );
  const themeAllowsStyling = themeAllowsStyleOverrides(themeCapabilities);
  // What this theme added to core's style vocabulary (ADR-0047) — the
  // panel needs it to draw a control for a property core never heard of.
  const { data: themeStyleProperties } = useQuery(
    themeStylePropertiesQueryOptions(activeThemeName),
  );

  const stylableProperties = themeAllowsStyling
    ? (descriptor.stylableProperties ?? [])
    : [];
  // marginTop/marginBottom are per-INSTANCE only (never per-type, see the
  // comment on blockStyleOverrideSchema in site-theme-tokens.ts) and only
  // for a top-level block: they are the one place where
  // PublicPageContent.astro reads `styleOverride.marginTop/marginBottom`
  // for the space between blocks — on a nested block they would have no
  // visual effect at all, so we do not offer them there. That is why the
  // set of properties shown in the instance popover can differ from the
  // type popover's, which always stays `stylableProperties`.
  // At every size since ADR-0050, where the wrapper was reworked. They
  // used to be dropped at the narrow sizes for a second reason: the space
  // between root blocks was an inline style whose DEFAULT depended on the
  // block's position, so it could not be part of the generated
  // per-breakpoint rules, and offering the field would have let somebody
  // set a mobile margin and watch nothing happen. The default is
  // `.brisk-root-block:last-child` in CSS now — position is something a
  // selector knows — so the margins are ordinary responsive properties.
  //
  // ...and all of it only while the theme allows styling at all: the two
  // margins are added AFTER `stylableProperties`, so gating that list
  // alone left them through and the instance button stayed on a theme
  // that refuses everything. Found by the test below, not by reading.
  const instanceStylableProperties: readonly BlockStylePropertyName[] =
    !themeAllowsStyling
      ? []
      : isRootLevel
        ? [
            ...stylableProperties,
            'marginTop',
            'marginBottom',
            // The motion set (docs/adr/0060) joins the margins here for
            // the same two reasons: per-instance only, and root-level
            // only — what animates is the wrapper, which exists once per
            // placement. A nested block would get a control that moves
            // nothing.
            'animation',
            'animationDuration',
            'animationDelay',
            'animationEasing',
            'hoverEffect',
          ]
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
      Object.entries({
        // The type's own base first, then what it changes at this size:
        // together they are what an uncustomized instance really shows
        // here (ADR-0047).
        ...typeStyle?.base,
        ...typeStyle?.[breakpoint],
      }).filter(([, v]) => v != null),
    ),
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {/*
        The breadcrumb was the selected block's own label and nothing
        else — a label pretending to be a trail. It is the ancestor chain
        now, and every step of it selects that ancestor: a block inside a
        Column inside a Columns was otherwise unreachable except by
        hunting for a pixel its children did not already cover, which is
        the whole reason the Layers panel had to grow click-to-select.
      */}
      <div
        data-testid="block-breadcrumb"
        className="pointer-events-auto flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow-sm"
        style={toPillStyle(geometry, rect)}
      >
        {ancestry.length > 0
          ? ancestry.map((step, index) => (
              <span key={step.id} className="flex items-center gap-1">
                {index > 0 && <span aria-hidden="true">›</span>}
                {index === ancestry.length - 1 ? (
                  // The selected block itself: a label, not a button —
                  // clicking it would select what is already selected.
                  <span>{step.label}</span>
                ) : (
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => onSelectBlock?.(step.id)}
                  >
                    {step.label}
                  </button>
                )}
              </span>
            ))
          : tLabel(descriptor.label)}
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
        {/* The per-TYPE style used to sit here, behind a brush. It
            edits `site.themeTokens.blockStyles[type]` — every block of
            that type on the whole site — from a toolbar whose every
            other control acts on this one block, which is a control that
            looks local and is not.

            It is not lost: the Style screen edits exactly the same
            values, for every type, with its own breakpoint selector. What
            goes is the shortcut of restyling a type while looking at one
            instance of it. */}
        {/*
          Deliberately NOT gated on the theme's ceiling, unlike the
          type-level styling button above and the instance style fields
          this panel now carries. A variant is a look the THEME itself
          declares, so choosing between them is picking from the theme's
          own vocabulary — not a site putting its own presentation on top,
          which is what the ceiling refuses. A theme that wants fewer
          looks ships fewer variants; it does not need the editor to hide
          the ones it declared.
        */}
        {(descriptor.fields.length > 0 ||
          (descriptor.variants?.length ?? 0) > 0 ||
          canStyleInstance) && (
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
                onChangeVariant={onChangeVariant}
                onChangeAlign={onChangeAlign}
                sectionEditing={sectionEditing}
                /*
                  This block's OWN styling, inside the same panel as its
                  content since ADR-0062 — it used to be a second popover
                  behind its own button, which meant changing a heading's
                  text and its colour were two different places with two
                  different shapes for the same block. The TYPE-level
                  button beside it stays separate on purpose: that one
                  edits every block of this type on the site, which is a
                  different thing to be doing, not a different tab.
                */
                instanceStyleFields={
                  canStyleInstance ? (
                    <BlockStyleFields
                      blockType={block.type}
                      themeProperties={themeStyleProperties?.[block.type]}
                      properties={instanceStylableProperties}
                      value={block.styleOverride?.[breakpoint] ?? {}}
                      onChange={onChangeInstanceStyle}
                      defaults={styleFieldDefaults(
                        instanceStyleDefaults,
                        block.styleOverride,
                      )}
                      themeTokens={themeTokens}
                    />
                  ) : null
                }
              />
            </PopoverContent>
          </Popover>
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
