import { z } from 'zod';
import { customFieldControlSchema } from './custom-field-control';
import {
  blockStyleDefaultsSchema,
  blockStyleOverrideSchema,
} from './site-theme-tokens';

/**
 * The wire contract for `GET /api/themes/current/blocks` (docs/adr/0041)
 * — a theme's own extra block types, discovered from `themes/<name>/
 * blocks/*.block.ts` at build time and served to editor-app so it can
 * merge them into its block picker/Inspector. Deliberately a hand-written
 * schema independent of `@brisk/block-sdk`'s `BlockDescriptor`/
 * `FieldDescriptor` TS types, not derived from them — the same accepted
 * trade-off `BLOCK_STYLE_DEFAULTS`/icon manifest responses already make
 * (see resolve-theme-block-style-defaults.ts, resolve-theme-icons.ts):
 * apps/public-site and apps/editor-app get a small, independently
 * versionable wire shape instead of a new dependency edge onto
 * `@brisk/block-sdk`.
 *
 * `kind: 'custom'` used to be absent here, because it carried a live
 * React `ComponentType` and so could not cross an HTTP/JSON boundary. A
 * descriptor now names its control instead of holding it, so it can, and
 * a theme may declare one — see `customFieldControlSchema` for the set of
 * names, and `validateThemeBlockSet()` for the check that a theme has not
 * invented one the editor cannot draw.
 */
export const themeFieldDescriptorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    key: z.string(),
    label: z.string(),
    inlineEditable: z.boolean().optional(),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
    requiredUnless: z.string().optional(),
    translatable: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('textarea'),
    key: z.string(),
    label: z.string(),
    inlineEditable: z.boolean().optional(),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
    requiredUnless: z.string().optional(),
    translatable: z.boolean().optional(),
  }),
  // A theme must be able to declare one too, or rich text would be a
  // privilege of core blocks (ADR-0046, and the additive rule of
  // ADR-0048). Same shape as `textarea`; what differs is that the value
  // is sanitised HTML rather than a literal string.
  z.object({
    kind: z.literal('richtext'),
    key: z.string(),
    label: z.string(),
    inlineEditable: z.boolean().optional(),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
    requiredUnless: z.string().optional(),
    translatable: z.boolean().optional(),
  }),
  // Opened 2026-09-07. It used to be excluded with the note that a
  // `custom` field "carries a live React ComponentType, which cannot
  // cross an HTTP/JSON boundary" — true then, and no longer true: a
  // descriptor now NAMES its control instead of holding it (ADR-0046's
  // split), so it survives JSON like every other field. What still has to
  // be checked is that the name is one the editor knows, or the field
  // renders as a blank space under its label with no error anywhere.
  z.object({
    kind: z.literal('custom'),
    key: z.string(),
    label: z.string(),
    control: customFieldControlSchema,
  }),
  z.object({
    kind: z.enum(['radio', 'select']),
    key: z.string(),
    label: z.string(),
    options: z.array(z.object({ label: z.string(), value: z.string() })),
  }),
  z.object({
    kind: z.literal('number'),
    key: z.string(),
    label: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
  }),
  z.object({
    kind: z.literal('boolean'),
    key: z.string(),
    label: z.string(),
  }),
]);
export type ThemeFieldDescriptor = z.infer<typeof themeFieldDescriptorSchema>;

// The six sidebar categories a theme block can slot into — the same
// buckets `pageBlockCategories` (libs/block-registry/src/lib/config.ts)
// already groups every core block under, reused rather than inventing a
// separate "theme blocks" bucket (apps/editor-app's merge logic places a
// theme block directly alongside the core blocks of the same category).
export const themeBlockCategorySchema = z.enum([
  'layout',
  'content',
  'conversion',
  'media',
  'socialProof',
  'interactive',
]);
export type ThemeBlockCategory = z.infer<typeof themeBlockCategorySchema>;

export const themeBlockDescriptorSchema = z.object({
  type: z.string(),
  label: z.string(),
  category: themeBlockCategorySchema,
  defaultProps: z.record(z.string(), z.unknown()),
  fields: z.array(themeFieldDescriptorSchema),
  isContainer: z.boolean().optional(),
  allowedChildTypes: z.array(z.string()).optional(),
  stylableProperties: z.array(blockStyleOverrideSchema.keyof()).optional(),
  defaultStyle: blockStyleDefaultsSchema.optional(),
});
export type ThemeBlockDescriptor = z.infer<typeof themeBlockDescriptorSchema>;

// One block's i18n fragment — exactly what would sit under `blocks.<type>`
// in apps/editor-app's own en.json/it.json, without that prefix. Only the
// two locales this product supports today (it/en), same as everywhere
// else generated legal-document/theme content is locale-scoped.
export const themeBlockLocaleFragmentSchema = z.object({
  label: z.string(),
  fields: z
    .record(
      z.string(),
      z.object({
        fieldLabel: z.string(),
        options: z.record(z.string(), z.string()).optional(),
      }),
    )
    .optional(),
});
export type ThemeBlockLocaleFragment = z.infer<
  typeof themeBlockLocaleFragmentSchema
>;

export const themeBlockLocalesSchema = z.object({
  en: themeBlockLocaleFragmentSchema,
  it: themeBlockLocaleFragmentSchema,
});
export type ThemeBlockLocales = z.infer<typeof themeBlockLocalesSchema>;

export const themeBlockEntrySchema = z.object({
  descriptor: themeBlockDescriptorSchema,
  locales: themeBlockLocalesSchema,
});
export type ThemeBlockEntry = z.infer<typeof themeBlockEntrySchema>;

export const themeBlocksResponseSchema = z.array(themeBlockEntrySchema);
export type ThemeBlocksResponse = z.infer<typeof themeBlocksResponseSchema>;
