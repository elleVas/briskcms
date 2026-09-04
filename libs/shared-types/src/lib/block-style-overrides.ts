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
  return Object.entries(blockStyles)
    .map(([blockType, override]) => {
      const declarations = (
        Object.keys(BLOCK_STYLE_CUSTOM_PROPERTIES) as CssOverridableProperty[]
      )
        .map((field) => {
          const value = override[field];
          return value
            ? `${BLOCK_STYLE_CUSTOM_PROPERTIES[field]}: ${value};`
            : null;
        })
        .filter((declaration): declaration is string => declaration !== null)
        .join(' ');
      return declarations
        ? `.${blockTypeToClassName(blockType)} { ${declarations} }`
        : null;
    })
    .filter((rule): rule is string => rule !== null)
    .join('\n');
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
export function buildBlockInstanceStyle(
  override: BlockStyleOverride | undefined,
): string | undefined {
  if (!override) {
    return undefined;
  }
  const declarations = (
    Object.keys(BLOCK_STYLE_CUSTOM_PROPERTIES) as CssOverridableProperty[]
  )
    .map((field) => {
      const value = override[field];
      return value
        ? `${BLOCK_STYLE_CUSTOM_PROPERTIES[field]}: ${value};`
        : null;
    })
    .filter((declaration): declaration is string => declaration !== null)
    .join(' ');
  return declarations.length > 0 ? declarations : undefined;
}
