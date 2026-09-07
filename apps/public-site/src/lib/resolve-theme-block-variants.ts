import {
  collectThemeVariantExtensions,
  validateThemeVariantExtensions,
  type ThemeBlockVariant as SdkThemeBlockVariant,
} from '@brisk/block-sdk';
import {
  themeBlockVariantsResponseSchema,
  type ThemeBlockVariantsResponse,
} from '@brisk/shared-types';
import { partitionByTheme, resolveBundledThemeName } from './theme-registry';

/**
 * The looks a theme ADDS to a core block type (ADR-0047's fourth
 * decision, under ADR-0048's additive rule) — `themes/<name>/blocks/
 * <Type>.variants.ts`, next to the `.astro` override that usually
 * carries their CSS.
 *
 * A fourth file kind in that directory, deliberately separate from
 * `<Type>.block.ts`: that one DEFINES a block, and a theme naming it
 * `Button.block.ts` would be redefining the core Button rather than
 * extending it — which is exactly what ADR-0048 refuses. Adding is a
 * different verb and gets a different file.
 *
 * Nothing here reaches the render path: `BlockRenderer` builds the
 * variant class from `Block.variant` alone, so a theme's variant already
 * renders without this. What this feeds is the EDITOR's picker — without
 * it the look exists in CSS and nobody can choose it.
 */
const variantModules = import.meta.glob<{ default: SdkThemeBlockVariant[] }>(
  '../../../../themes/*/blocks/*.variants.ts',
  { eager: true },
);

const variantModulesByTheme = partitionByTheme(variantModules);

/** The locales the editor itself speaks, so a variant with no label in one of them is refused rather than shown as a raw key. */
const EDITOR_LOCALES = ['en', 'it'] as const;

const cacheByTheme = new Map<string, ThemeBlockVariantsResponse>();

/**
 * Throws on an invalid extension rather than skipping it, the same
 * posture as `loadValidatedCandidates`: this runs at the server/build
 * boundary where a theme author is there to read the message, and a look
 * silently missing from the picker is precisely the failure this whole
 * arc keeps designing against.
 *
 * The two checks that need the core registry — the type exists, and the
 * theme is not redeclaring a look core already has — are NOT here.
 * `apps/public-site` does not import `@brisk/block-registry` (a real
 * TypeScript resolution conflict, see
 * resolve-theme-block-style-defaults.ts), so they live in
 * `checkVariantsAgainstCore`, called from each theme's own `blocks.spec.ts`
 * where importing the registry is safe. Same split as the block-type
 * collision guard, and for the same reason.
 */
export function listThemeBlockVariants(
  themeName: string,
): ThemeBlockVariantsResponse {
  const resolvedTheme = resolveBundledThemeName(themeName);
  const cached = cacheByTheme.get(resolvedTheme);
  if (cached) {
    return cached;
  }

  const extensions = collectThemeVariantExtensions(
    variantModulesByTheme.get(resolvedTheme) ?? {},
  );
  const errors = validateThemeVariantExtensions(extensions, [
    ...EDITOR_LOCALES,
  ]);
  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${error.blockType}: ${error.message}`)
      .join('\n');
    throw new Error(
      `Invalid variant extension(s) under themes/${resolvedTheme}/blocks/:\n${details}`,
    );
  }

  // Parsed on the way out, not merely assembled: the values become CSS
  // classes and i18n keys in another application, so the wire shape is
  // checked where it is produced as well as where it is read.
  const response = themeBlockVariantsResponseSchema.parse(
    Object.fromEntries(
      extensions.map((extension) => [extension.blockType, extension.variants]),
    ),
  );
  cacheByTheme.set(resolvedTheme, response);
  return response;
}
