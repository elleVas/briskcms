/**
 * A theme adding named looks to a block type core already ships
 * (ADR-0047's fourth decision, under ADR-0048's additive rule).
 *
 * This is the surface ADR-0048 promised in place of letting a theme
 * redefine the block outright: twenty buttons out of a Figma file arrive
 * as twenty LOOKS of the one Button, not as twenty block types with
 * duplicated fields and a lost core Button. A theme declares them in
 * `themes/<name>/blocks/<Type>.variants.ts` and writes the CSS for
 * `.brisk-button--ghost` in its own stylesheet; nothing else changes, and
 * no stored page is touched.
 *
 * Labels live here rather than in a sibling `.locales.json`, unlike a
 * theme's own block type: that file exists because a whole descriptor has
 * many labels to translate, while a variant has exactly one. A second
 * file to remember, for one string per locale, buys nothing.
 */
export interface ThemeBlockVariant {
  /** Becomes part of a CSS class (`.brisk-button--ghost`), so it is checked like every other value that reaches a selector. */
  value: string;
  /** One label per locale the editor speaks. Registered under `blocks.<type>.variants.<value>`, the same key a core variant uses. */
  label: Record<string, string>;
}

/** One theme file: the core block type it extends, and what it adds. */
export interface ThemeBlockVariantExtension {
  blockType: string;
  variants: ThemeBlockVariant[];
}

export interface ThemeBlockVariantError {
  blockType: string;
  message: string;
}

const VARIANT_NAME = /^[a-z][a-z0-9-]{0,63}$/;
/** Reserved for the type's own look — `DEFAULT_VARIANT` in @brisk/shared-types, repeated rather than imported: this SDK stays free of that dependency so a theme can be built outside the monorepo (ADR-0037). */
const RESERVED_VARIANT = 'default';

/**
 * Shapes an `import.meta.glob({ eager: true })` map of
 * `<Type>.variants.ts` files into extensions. Pure and Vite-agnostic, for
 * the same reason as `collectThemeBlockCandidates`: the real loader and a
 * theme's own spec run the identical code, so a passing spec is evidence
 * about the loader and not merely about the spec.
 */
export function collectThemeVariantExtensions(
  variantModules: Record<string, { default: ThemeBlockVariant[] }>,
): ThemeBlockVariantExtension[] {
  return Object.entries(variantModules).map(([path, mod]) => {
    const fileName = path.slice(path.lastIndexOf('/') + 1);
    return {
      blockType: fileName.endsWith('.variants.ts')
        ? fileName.slice(0, -'.variants.ts'.length)
        : fileName,
      variants: mod.default,
    };
  });
}

/**
 * What can be checked without knowing the core registry: names, labels,
 * and a theme repeating itself.
 *
 * `apps/public-site` deliberately does not import `@brisk/block-registry`
 * (a real TypeScript resolution conflict, see
 * resolve-theme-block-style-defaults.ts), so the runtime loader can only
 * go this far. The checks that need the core descriptors — the type
 * actually exists, and the theme is not redeclaring a variant core
 * already has — live in `checkVariantsAgainstCore` below, called from
 * each theme's own spec, which may import the registry freely. Same split
 * as the block-type collision guard, and for the same reason.
 */
export function validateThemeVariantExtensions(
  extensions: readonly ThemeBlockVariantExtension[],
  locales: readonly string[],
): ThemeBlockVariantError[] {
  const errors: ThemeBlockVariantError[] = [];

  for (const extension of extensions) {
    if (!Array.isArray(extension.variants) || extension.variants.length === 0) {
      errors.push({
        blockType: extension.blockType,
        message: 'must default-export a non-empty array of variants',
      });
      continue;
    }

    const seen = new Set<string>();
    for (const variant of extension.variants) {
      if (!VARIANT_NAME.test(variant.value)) {
        errors.push({
          blockType: extension.blockType,
          message: `variant "${variant.value}" must be lower case letters, digits and dashes, starting with a letter — it becomes a CSS class`,
        });
        continue;
      }
      if (variant.value === RESERVED_VARIANT) {
        errors.push({
          blockType: extension.blockType,
          message: `variant "${RESERVED_VARIANT}" is reserved for the block type's own look`,
        });
        continue;
      }
      if (seen.has(variant.value)) {
        errors.push({
          blockType: extension.blockType,
          message: `variant "${variant.value}" is declared twice`,
        });
        continue;
      }
      seen.add(variant.value);

      const missing = locales.filter((locale) => !variant.label?.[locale]);
      if (missing.length > 0) {
        errors.push({
          blockType: extension.blockType,
          message: `variant "${variant.value}" has no label for ${missing.join(', ')}`,
        });
      }
    }
  }

  return errors;
}

/**
 * The half that needs the core registry: a theme may only extend a type
 * that EXISTS, and may not redeclare a look core already ships.
 *
 * Extending an unknown type is almost always a typo — `Buttton.variants.ts`
 * would otherwise sit there declaring looks nobody can pick, with nothing
 * failing. Redeclaring a core variant would put the same value in the
 * picker twice, one of them unreachable.
 */
export function checkVariantsAgainstCore(
  extensions: readonly ThemeBlockVariantExtension[],
  coreVariantsByType: Readonly<Record<string, readonly string[]>>,
  coreBlockTypes: readonly string[],
): ThemeBlockVariantError[] {
  const known = new Set(coreBlockTypes);
  return extensions.flatMap((extension) => {
    if (!known.has(extension.blockType)) {
      return [
        {
          blockType: extension.blockType,
          message:
            'is not a core block type — a theme extends the variants of a type that exists, and adds a new type with its own .block.ts',
        },
      ];
    }
    const core = new Set(coreVariantsByType[extension.blockType] ?? []);
    return extension.variants
      .filter((variant) => core.has(variant.value))
      .map((variant) => ({
        blockType: extension.blockType,
        message: `variant "${variant.value}" is already one of this block's own — add a different look, or restyle that one from the editor`,
      }));
  });
}
