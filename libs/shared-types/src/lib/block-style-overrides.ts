import type { Block } from './content-model';
import type { BlockStyleOverride } from './site-theme-tokens';

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
  blockStyles: Record<string, BlockStyleOverride>,
): string {
  const rules = Object.entries(blockStyles)
    .map(([blockType, override]) => {
      const className = safeBlockTypeClassName(blockType);
      const declarations = buildOverrideDeclarations(override);
      return className && declarations
        ? `.${className} { ${declarations} }`
        : null;
    })
    .filter((rule): rule is string => rule !== null);
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

/** The declaration list of one override — the single place the property map is walked, so the emitters below cannot drift apart. */
function buildOverrideDeclarations(
  override: BlockStyleOverride,
): string | null {
  const declarations = (
    Object.keys(BLOCK_STYLE_CUSTOM_PROPERTIES) as CssOverridableProperty[]
  )
    .map((field) => {
      const value = safeDeclarationValue(override[field]);
      return value
        ? `${BLOCK_STYLE_CUSTOM_PROPERTIES[field]}: ${value};`
        : null;
    })
    .filter((declaration): declaration is string => declaration !== null)
    .join(' ');
  return declarations.length > 0 ? declarations : null;
}

export function buildBlockInstanceStyle(
  override: BlockStyleOverride | undefined,
): string | undefined {
  return override
    ? (buildOverrideDeclarations(override) ?? undefined)
    : undefined;
}

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
  found: { id: string; override: BlockStyleOverride }[] = [],
): { id: string; override: BlockStyleOverride }[] {
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
    .map(({ id, override }) => {
      const className = blockInstanceClassName(id);
      const declarations = buildOverrideDeclarations(override);
      return className && declarations
        ? `.${className} { ${declarations} }`
        : null;
    })
    .filter((rule): rule is string => rule !== null);
  return rules.length > 0
    ? `@layer brisk.instance {\n${rules.join('\n')}\n}`
    : '';
}
