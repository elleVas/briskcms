import type { Block } from './content-model';
import {
  BREAKPOINT_MAX_WIDTHS,
  BREAKPOINTS,
  DEFAULT_VARIANT,
  type BlockStyleOverride,
  type ResponsiveBlockStyle,
} from './site-theme-tokens';

/**
 * One custom-property name per field, shared by every block type
 * (docs/adr/0022) — not a `--button-radius` for Button and a
 * `--card-radius` for some other type: a block's `.astro` always reads
 * `var(--brisk-override-*, <the theme's default>)` whatever the type, so
 * the property name does not need to know the type — it is the CSS rule
 * that already scopes it per type (see `buildBlockStyleOverridesCss`
 * below). It lives in shared-types (not only in apps/public-site) because
 * editor-app uses it too, to update the `<style>` inside the canvas iframe
 * live when the "Style" button saves — the same logic, not duplicated
 * across the two apps.
 *
 * `marginTop`/`marginBottom` are deliberately EXCLUDED from this map — they
 * never become a per-type scoped CSS custom property: see the comment on
 * them in `site-theme-tokens.ts` for why (a
 * `.brisk-<type> { margin-bottom: ... }` rule would also touch nested
 * instances, where the space between siblings is already handled by the
 * container). They stay a plain data field on `Block.styleOverride`, read
 * directly by `PublicPageContent.astro` for a top-level block.
 */
type CssOverridableProperty = Exclude<
  keyof BlockStyleOverride,
  'marginTop' | 'marginBottom'
>;

export const BLOCK_STYLE_CUSTOM_PROPERTIES: Record<
  CssOverridableProperty,
  string
> = {
  backgroundColor: '--brisk-override-bg',
  textColor: '--brisk-override-text',
  borderRadius: '--brisk-override-radius',
  paddingX: '--brisk-override-padding-x',
  paddingY: '--brisk-override-padding-y',
  borderWidth: '--brisk-override-border-width',
  borderStyle: '--brisk-override-border-style',
  borderColor: '--brisk-override-border-color',
  boxShadow: '--brisk-override-shadow',
  backgroundImage: '--brisk-override-bg-image',
  backgroundPosition: '--brisk-override-bg-position',
  backgroundSize: '--brisk-override-bg-size',
  backgroundRepeat: '--brisk-override-bg-repeat',
  overlayColor: '--brisk-override-overlay',
  minHeight: '--brisk-override-min-height',
  maxWidth: '--brisk-override-max-width',
  gap: '--brisk-override-gap',
  contentAlign: '--brisk-override-align',
  contentJustify: '--brisk-override-justify',
};

/**
 * "Button" -> "brisk-button", "PromoBar" -> "brisk-promo-bar" — the class
 * convention every styled block already follows by hand (Container.astro's
 * `.brisk-container`, Column.astro's `.brisk-column`, …). It derives the
 * class from the TYPE rather than requiring every block to declare it
 * explicitly somewhere: one place to keep consistent with the convention
 * instead of two.
 */
export function blockTypeToClassName(blockType: string): string {
  return `brisk-${blockType.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

/**
 * The class that carries ONE variant of a block type
 * (`.brisk-button--secondary`), or `null` for anything that is not a
 * variant name.
 *
 * `null` and not a thrown error, and not the bare type class either: a
 * block may name a variant its current theme does not define — that is
 * ADR-0048's rule working as intended, a theme hiding a design it does
 * not have — and the answer is that the block renders in its default look.
 * Refusing the name outright would take the page down; falling back to
 * the type class silently would be the same thing as no variant, which is
 * what the caller does with `null` anyway, but stated where it can be
 * read.
 *
 * The character rule is the exit barrier, the same one the block type key
 * gets: whatever reaches a selector is checked where it gets there, not
 * only where it was written (PR #144).
 */
export function blockVariantClassName(
  blockType: string,
  variant: string | undefined,
): string | null {
  if (!variant || variant === DEFAULT_VARIANT) {
    return null;
  }
  const className = safeBlockTypeClassName(blockType);
  return className && /^[a-z][a-z0-9-]{0,63}$/.test(variant)
    ? `${className}--${variant}`
    : null;
}

/**
 * The "component-level" override (docs/adr/0022) — one CSS rule per styled
 * block type, scoped by the block's own `.brisk-*` class and NOT by
 * `[data-brisk-block-type]`: that wrapper only exists when `editable` is
 * true (BlockRenderer.astro) — on the published site, for a real visitor,
 * it is absent, so a rule scoped there would never take effect outside the
 * editor, the exact opposite of this feature's purpose. The block's class,
 * by contrast, is on the real markup in BOTH contexts. No `!important`:
 * unlike Tier 1's colours and fonts (docs/adr/0021), there is no
 * higher-specificity rule to beat here — the block itself reads
 * `var(--brisk-override-x, <default>)`, so whatever the custom property
 * resolves to is already the winning value by construction.
 */
export function buildBlockStyleOverridesCss(
  blockStyles: Record<string, Record<string, ResponsiveBlockStyle>>,
): string {
  const rules = Object.entries(blockStyles).flatMap(
    ([blockType, byVariant]) => {
      const className = safeBlockTypeClassName(blockType);
      if (!className) {
        return [];
      }
      return Object.entries(byVariant ?? {}).flatMap(([variant, style]) => {
        // The type's own look is the bare class; a variant adds its
        // modifier, and goes through the same character rule as everything
        // else that reaches a selector.
        const target =
          variant === DEFAULT_VARIANT
            ? className
            : blockVariantClassName(blockType, variant);
        return target ? buildResponsiveRules(`.${target}`, style) : [];
      });
    },
  );
  // A named tier rather than source order — see buildBlockInstanceRulesCss.
  return rules.length > 0 ? `@layer brisk.class {\n${rules.join('\n')}\n}` : '';
}

/**
 * The per-instance override (docs/adr/0022) — the same custom properties as
 * above, but as an inline `style` attribute on the block's REAL element
 * (the component itself, Button.astro for instance, receives
 * `styleOverride` as an extra prop alongside its own — not the
 * `data-brisk-block-*` wrapper, which for the same reason as
 * `buildBlockStyleOverridesCss` above does not exist on the published
 * site). An inline style always beats the per-type rule for that same
 * element — no `!important` here either, for the same reason.
 */
/**
 * The same characters `cssValueSchema` refuses, checked again at the point
 * the string actually becomes CSS.
 *
 * Two barriers rather than one because they fail differently. The schema
 * guards the entrance and keeps the database clean; this guards the exit,
 * and covers what the schema cannot see — rows written before the schema
 * was tightened, a future write path that forgets to use it, a theme
 * supplying its own defaults. A function whose job is to emit a stylesheet
 * should not depend on its caller having validated the input.
 *
 * A declaration that fails is dropped, not escaped: there is no correct
 * escaping for "this was supposed to be a colour", and a block rendering
 * with its default appearance is a better outcome than one rendering with
 * whatever the string was trying to do.
 */
const CSS_VALUE_BREAKOUT = /[;{}@<>\\]|\/\*|\*\//;

function safeDeclarationValue(value: unknown): string | null {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 200 &&
    !CSS_VALUE_BREAKOUT.test(value)
    ? value
    : null;
}

/** A block type only ever names a class here, so anything that is not an identifier cannot. */
function safeBlockTypeClassName(blockType: string): string | null {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(blockType)
    ? blockTypeToClassName(blockType)
    : null;
}

/**
 * Every rule one styled thing needs, at every size — the base declaration
 * plus one container query per narrower tier that changes something.
 *
 * **Container queries, not media queries.** Elementor and Webflow drive
 * responsive styling from the viewport and inherit its defect: a block
 * inside a narrow column, seen on a wide screen, gets the DESKTOP styles
 * because the window is wide, and breaks. A container query asks how much
 * room the block actually has. For a block at the top level of a page
 * that is the same question — its container is as wide as the viewport —
 * so nothing feels different until the case where the viewport was the
 * wrong thing to ask about.
 *
 * Narrower tiers come last, so mobile wins over tablet where both match.
 *
 * The dangerous part, and the reason for the invariant in
 * `container-type.spec.ts`: if no ancestor declares `container-type`,
 * `@container` simply never matches. No error, no warning, nothing in
 * devtools marking the rule inert.
 */
/**
 * The breakpoint buckets of a stored override, whatever shape it is in.
 *
 * Deliberately NOT `responsiveBlockStyleSchema.parse`, though the schema
 * describes the same shape: a parse THROWS on a value it dislikes, and
 * this runs while rendering a page. One bad string in one block's
 * override — left by an older version, a hand-edited row, an attempt at
 * injection — would take down the whole page instead of costing that one
 * declaration. The schema guards the boundary where rejecting the write
 * is the right answer; here the right answer is to emit everything that
 * is fine and drop what is not, which `safeDeclarationValue` already does
 * per declaration.
 */
function responsiveBuckets(style: unknown): Record<string, unknown>[] {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  if (!isRecord(style)) {
    return [{}, {}, {}];
  }
  // The old flat shape is the new one with only `base` — see the same
  // reasoning in `responsiveBlockStyleSchema`.
  if (!('base' in style)) {
    return [style, {}, {}];
  }
  return BREAKPOINTS.map((breakpoint) => {
    const bucket = style[breakpoint];
    return isRecord(bucket) ? bucket : {};
  });
}

function buildResponsiveRules(selector: string, style: unknown): string[] {
  const [base, tablet, mobile] = responsiveBuckets(style);
  const perBreakpoint = { tablet, mobile };
  const rules: string[] = [];
  const baseDeclarations = buildOverrideDeclarations(base);
  if (baseDeclarations) {
    rules.push(`${selector} { ${baseDeclarations} }`);
  }
  for (const breakpoint of ['tablet', 'mobile'] as const) {
    const declarations = buildOverrideDeclarations(perBreakpoint[breakpoint]);
    if (declarations) {
      rules.push(
        `@container (max-width: ${BREAKPOINT_MAX_WIDTHS[breakpoint]}px) { ${selector} { ${declarations} } }`,
      );
    }
  }
  return rules;
}

/** The declaration list of one override — the single place the property map is walked, so the emitters below cannot drift apart. */
function buildOverrideDeclarations(
  override: Readonly<Record<string, unknown>>,
): string | null {
  const core = (
    Object.keys(BLOCK_STYLE_CUSTOM_PROPERTIES) as CssOverridableProperty[]
  ).map((field) => {
    const value = safeDeclarationValue(override[field]);
    return value ? `${BLOCK_STYLE_CUSTOM_PROPERTIES[field]}: ${value};` : null;
  });

  // Anything else in the override came from a THEME's own style property
  // (ADR-0047). Core's names are not mechanical — `backgroundColor` is
  // `--brisk-override-bg` — so they stay a map; a theme's is derived from
  // its key, which is why the theme never gets to name the variable and
  // cannot collide with core's or point two properties at one name.
  const themeProperties = Object.keys(override)
    .filter((key) => !(key in BLOCK_STYLE_CUSTOM_PROPERTIES))
    .map((key) => {
      const name = themeStylePropertyName(key);
      const value = safeDeclarationValue(override[key]);
      return name && value ? `${name}: ${value};` : null;
    });

  const declarations = [...core, ...themeProperties]
    .filter((declaration): declaration is string => declaration !== null)
    .join(' ');
  return declarations.length > 0 ? declarations : null;
}

/**
 * `letterSpacing` becomes `--brisk-override-letter-spacing`, or `null`
 * for anything that could not safely be a custom property name.
 *
 * The exit barrier for a theme's own style properties, and it is not
 * redundant with the schema's: an override reaches here from the database
 * too, where a row may predate the rule or have been edited by hand. The
 * lesson of PR #144 is that whatever reaches a stylesheet is checked
 * where it gets there, not only where it was written.
 *
 * `marginTop`/`marginBottom` are the one case this must NOT catch: they
 * are core keys deliberately absent from the map above (instance-only,
 * see site-theme-tokens.ts), so they are excluded here explicitly rather
 * than silently becoming `--brisk-override-margin-top` — which would
 * quietly resurrect them as a per-type rule.
 */
function themeStylePropertyName(key: string): string | null {
  if (
    !/^[a-z][A-Za-z0-9]{0,63}$/.test(key) ||
    INSTANCE_ONLY_PROPERTIES.has(key)
  ) {
    return null;
  }
  return `--brisk-override-${key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

/** Core properties that are deliberately not CSS custom properties at all — see BLOCK_STYLE_CUSTOM_PROPERTIES's own comment. */
const INSTANCE_ONLY_PROPERTIES = new Set(['marginTop', 'marginBottom']);

/**
 * The class that carries ONE block instance's overrides.
 *
 * Block ids are generated (`crypto.randomUUID`), so anything that is not
 * one is refused: this value becomes a CSS selector, and the lesson of
 * the block-type key is that whatever reaches a selector is checked where
 * it gets there, not only where it was written.
 */
export function blockInstanceClassName(blockId: string): string | null {
  return /^[A-Za-z0-9-]{1,64}$/.test(blockId) ? `b-${blockId}` : null;
}

/** Every block of a tree carrying an override, children included. */
function collectStyledBlocks(
  blocks: Block[],
  found: { id: string; override: ResponsiveBlockStyle }[] = [],
): { id: string; override: ResponsiveBlockStyle }[] {
  for (const block of blocks) {
    if (block.id && block.styleOverride) {
      found.push({ id: block.id, override: block.styleOverride });
    }
    if (block.children) {
      collectStyledBlocks(block.children, found);
    }
  }
  return found;
}

/**
 * The per-INSTANCE overrides of a page, as real CSS rules.
 *
 * They were an inline `style` attribute, and the cascade worked by
 * construction: inline beats the per-type rule, no `!important` needed.
 * Elegant, and a dead end — **an HTML `style` attribute cannot contain a
 * media query** (ADR-0047). That is not a limitation of this code, it is
 * the language, and per-breakpoint styling per instance is impossible
 * while the value stays inline.
 *
 * Two rules of equal specificity then decide by source order, which is
 * exactly the fragile detail someone eventually breaks. `@layer` makes a
 * later layer win regardless of specificity OR order, so the tier model
 * becomes one readable line instead of a convention resting on an
 * accident.
 *
 * Deliberately only these two layers. The theme's own `:root` tokens stay
 * unlayered: moving them would change how they interact with
 * `!important`, where layer order REVERSES — and they are not in conflict
 * with anything here anyway, because a declaration on an element always
 * beats an inherited one, whatever layer it came from.
 */
export function buildBlockInstanceRulesCss(contents: Block[][]): string {
  const rules = contents
    .flatMap((content) => collectStyledBlocks(content))
    .flatMap(({ id, override }) => {
      const className = blockInstanceClassName(id);
      return className ? buildResponsiveRules(`.${className}`, override) : [];
    });
  return rules.length > 0
    ? `@layer brisk.instance {\n${rules.join('\n')}\n}`
    : '';
}
