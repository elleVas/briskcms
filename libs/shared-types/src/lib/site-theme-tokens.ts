import { z } from 'zod';

/**
 * A raw CSS length value ("6px", "0.5rem", "9999px" for a pill) — with no
 * unit imposed: letting the user pick px/rem/% rather than forcing one unit
 * is closer to how the CSS var it feeds downstream works (see
 * PageLayout.astro). `null` = not customized, inheriting the active theme's
 * default.
 */
export const cssLengthTokenSchema = z.string().min(1).nullable();

/** Un colore CSS grezzo (qualunque sintassi valida — hex, oklch, var(...)). `null` = non personalizzato. */
export const cssColorTokenSchema = z.string().min(1).nullable();

/**
 * The style properties a block can make overridable — ONE shape shared by
 * every block type (docs/adr/0022), not a Zod field added by hand to each
 * of the 48+ types: not every block uses every property (a Text has no
 * sensible "border radius"), and it is
 * `BlockDescriptor.stylableProperties` that declares which of these are
 * actually relevant to a given type.
 */
export const blockStyleOverrideSchema = z.object({
  backgroundColor: cssColorTokenSchema.optional(),
  textColor: cssColorTokenSchema.optional(),
  borderRadius: cssLengthTokenSchema.optional(),
  paddingX: cssLengthTokenSchema.optional(),
  paddingY: cssLengthTokenSchema.optional(),
  // Unlike the other properties above, these two are deliberately EXCLUDED
  // from BLOCK_STYLE_CUSTOM_PROPERTIES (block-style-overrides.ts) — they
  // make no sense as a per-TYPE CSS rule scoped by `.brisk-<type>` (it
  // would touch every instance of that type anywhere, including ones nested
  // inside a Container/Columns, where the space between siblings is already
  // handled by the container's gap). They are applied per-instance instead,
  // and only for a top-level block of the page (PublicPageContent.astro) —
  // see editor-app's block-toolbar-overlay.tsx `isRootLevel` for the gate
  // on the editor side.
  marginTop: cssLengthTokenSchema.optional(),
  marginBottom: cssLengthTokenSchema.optional(),
});
export type BlockStyleOverride = z.infer<typeof blockStyleOverrideSchema>;

/**
 * The "component-level" override (docs/adr/0022) — it replaces the old
 * fixed `{ buttons: {...} }` shape with a generic map keyed by block type:
 * any type can receive an override without needing a new dedicated Zod
 * field each time. Applied to ALL instances of that type across the site —
 * see `Block.styleOverride` for the single-instance override.
 */
export const themeTokensSchema = z.object({
  blockStyles: z.record(z.string(), blockStyleOverrideSchema),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

/** No customized types — every block uses its own existing CSS defaults. */
export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  blockStyles: {},
};

/**
 * A per-type update (the `PATCH /sites/:id/theme-tokens` endpoint): the
 * body carries the complete override for ONE block type at a time (the
 * toolbar's "Style" button always edits the selected block's type) — it
 * replaces that map entry wholesale, leaving every other already-saved type
 * untouched.
 */
export const updateThemeTokensBodySchema = z.object({
  blockType: z.string().min(1),
  style: blockStyleOverrideSchema,
});
export type UpdateThemeTokensBody = z.infer<typeof updateThemeTokensBodySchema>;

/**
 * The RESOLVED value (not a raw token) of every stylable property for a
 * block type, against the active theme — `borderRadius: "0.5rem"`, say,
 * never an unresolved `"var(--radius)"`. Unlike `BlockStyleOverride`, every
 * key present here ALWAYS has a string value: there is no "null default", a
 * stylable block always has some appearance when not customized, and that
 * appearance is what this type captures. Source:
 * `BlockDescriptor.defaultStyle` (block-registry, the declared expression,
 * e.g. `var(--primary)`) resolved against the active theme's `theme.css` —
 * see `apps/public-site/src/lib/resolve-theme-block-style-defaults.ts`.
 */
export const blockStyleDefaultsSchema = z.object({
  backgroundColor: z.string().min(1).optional(),
  textColor: z.string().min(1).optional(),
  borderRadius: z.string().min(1).optional(),
  paddingX: z.string().min(1).optional(),
  paddingY: z.string().min(1).optional(),
  // marginTop/marginBottom have no "theme default" to resolve (they depend
  // on no theme — see the comment on them in `blockStyleOverrideSchema`
  // above): these two fields always stay `undefined` here, never populated
  // by resolve-theme-block-style-defaults.ts. They are declared anyway to
  // keep the type aligned with `BlockStyleOverride` — the shared UI
  // (editor-app's block-style-fields.tsx) indexes `defaults` with
  // `keyof BlockStyleOverride`, and omitting them here would force that
  // code into a cast instead of a correct type.
  marginTop: z.string().min(1).optional(),
  marginBottom: z.string().min(1).optional(),
});
export type BlockStyleDefaults = z.infer<typeof blockStyleDefaultsSchema>;

/** Corpo di risposta di `GET /api/themes/current/block-style-defaults` (apps/public-site): una entry per tipo di blocco stilizzabile. */
export const blockStyleDefaultsResponseSchema = z.record(
  z.string().min(1),
  blockStyleDefaultsSchema,
);
export type BlockStyleDefaultsResponse = z.infer<
  typeof blockStyleDefaultsResponseSchema
>;

/**
 * The response body of `GET /api/themes/current/foreground-tokens`
 * (apps/public-site) — the active theme's two root tokens
 * `--primary-foreground`/`--secondary-foreground`, resolved (not a raw
 * `var(--x)`). A separate endpoint from `block-style-defaults` above: those
 * two tokens are the default of NO stylable property declared for any block
 * type (only `Button`/`PromoBar` reference `--primary-foreground` in
 * passing, and `--secondary-foreground` nowhere) — they serve the WCAG
 * contrast check on the theme's own primary/secondary colour pickers
 * (GlobalStylesDialog) instead, not a block.
 */
export const themeForegroundTokensSchema = z.object({
  primaryForeground: z.string().min(1),
  secondaryForeground: z.string().min(1),
});
export type ThemeForegroundTokens = z.infer<typeof themeForegroundTokensSchema>;

/**
 * The response body of `GET /api/themes/current/base-tokens`
 * (apps/public-site) — the raw values the active theme's `theme.css`
 * declares for `--primary`/`--secondary`/`--font-sans-value`/`--radius`.
 * Unlike `themeForegroundTokensSchema` above (which only serves the
 * contrast check), these feed the starting values shown in
 * GlobalStylesDialog: before this endpoint, "no Tier 1 override set"
 * displayed a generic hardcoded fallback (`#18181b`) rather than the active
 * theme's real colour or font — a theme had no way of showing the editor
 * its own base values. Read-only: the editor never writes these fields,
 * they are a starting point rather than an override (that stays
 * `site.themePrimaryColor` and friends).
 */
export const themeBaseTokensSchema = z.object({
  primary: z.string().min(1),
  secondary: z.string().min(1),
  fontSansValue: z.string().min(1),
  radius: z.string().min(1),
});
export type ThemeBaseTokens = z.infer<typeof themeBaseTokensSchema>;
