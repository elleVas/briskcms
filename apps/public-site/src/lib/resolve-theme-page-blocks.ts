import {
  collectThemeBlockCandidates,
  validateThemeBlockSet,
  type BlockDescriptor,
  type ThemeBlockCandidate,
} from '@brisk/block-sdk';
import type { ThemeBlocksResponse } from '@brisk/shared-types';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import {
  buildDispatchEntry,
  buildThemeBlocksResponseEntry,
  checkCoreTypeCollisions,
  type ThemeBlockDispatchEntry,
} from './resolve-theme-page-blocks-helpers';

/**
 * Docs/adr/0041 — a theme's own genuinely NEW block types (not just an
 * override of an existing one, see resolve-theme-block-override.ts for
 * that separate, unchanged mechanism). Same build-time-only glob
 * technique, three files instead of one: `~theme/blocks/<Type>.block.ts`
 * (descriptor + schema), `<Type>.astro` (render), `<Type>.locales.json`
 * (i18n). `import.meta.glob` against a pattern that matches nothing
 * (most themes add none of these) simply returns `{}` — no error.
 *
 * Validation failures **throw**, deliberately, unlike the client-side
 * merge in apps/editor-app (which degrades a single bad entry instead) —
 * this runs at `astro build`/`astro dev` startup, with a developer right
 * there to see the message, the same posture every core block's
 * `defineBlock()` already has via its own `schema.parse()`.
 */
interface BlockModule {
  default: BlockDescriptor;
  schema?: { parse: (props: unknown) => Record<string, unknown> };
}

const blockModules = import.meta.glob<BlockModule>('~theme/blocks/*.block.ts', {
  eager: true,
});
const astroModules = import.meta.glob<{ default: AstroComponentFactory }>(
  '~theme/blocks/*.astro',
  { eager: true },
);
const localesModules = import.meta.glob('~theme/blocks/*.locales.json', {
  eager: true,
  import: 'default',
}) as Record<string, ThemeBlockCandidate['locales']>;

function basenameOf(globPath: string, suffix: string): string {
  const fileName = globPath.slice(globPath.lastIndexOf('/') + 1);
  return fileName.endsWith(suffix)
    ? fileName.slice(0, -suffix.length)
    : fileName;
}

const renderComponentsByBasename = new Map(
  Object.entries(astroModules).map(([path, mod]) => [
    basenameOf(path, '.astro'),
    mod.default,
  ]),
);
const schemasByBasename = new Map(
  Object.entries(blockModules).map(([path, mod]) => [
    basenameOf(path, '.block.ts'),
    mod.schema,
  ]),
);

function loadValidatedCandidates(
  coreBlockTypes: readonly string[],
): ThemeBlockCandidate[] {
  const candidates = collectThemeBlockCandidates(
    blockModules,
    astroModules,
    localesModules,
  );
  const errors = [
    ...checkCoreTypeCollisions(candidates, coreBlockTypes),
    ...validateThemeBlockSet(candidates),
  ];
  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${error.basename}: ${error.message}`)
      .join('\n');
    throw new Error(`Invalid theme block(s) under ~theme/blocks/:\n${details}`);
  }
  return candidates;
}

let cachedRegistry: Record<string, ThemeBlockDispatchEntry> | null = null;

/**
 * Spread into `BlockRenderer.astro`'s own `BLOCK_REGISTRY` via
 * `Object.assign` — the one, one-time edit that file needs for this
 * whole mechanism (see that file's own comment). `coreBlockTypes` is
 * passed in by the caller (`Object.keys(BLOCK_REGISTRY)`, its own
 * existing keys) rather than imported from `@brisk/block-registry`
 * directly: that package has previously caused a real TypeScript
 * resolution conflict when imported into apps/public-site (see
 * resolve-theme-block-style-defaults.ts's own comment for the same,
 * already-hit problem) — this loader stays unaware of any specific core
 * block type by construction, not just by convention.
 */
export function themeBlockRegistry(
  coreBlockTypes: readonly string[],
): Record<string, ThemeBlockDispatchEntry> {
  if (cachedRegistry) return cachedRegistry;
  const candidates = loadValidatedCandidates(coreBlockTypes);
  const registry: Record<string, ThemeBlockDispatchEntry> = {};
  for (const candidate of candidates) {
    const component = renderComponentsByBasename.get(candidate.basename);
    const schema = schemasByBasename.get(candidate.basename);
    if (!component || !schema) continue; // unreachable once validation passed
    registry[candidate.descriptor.type] = buildDispatchEntry(
      candidate.descriptor,
      component,
      schema,
    );
  }
  cachedRegistry = registry;
  return registry;
}

let cachedResponse: ThemeBlocksResponse | null = null;

/** Backs `GET /api/themes/current/blocks`. */
export function listThemePageBlocks(
  coreBlockTypes: readonly string[],
): ThemeBlocksResponse {
  if (cachedResponse) return cachedResponse;
  const candidates = loadValidatedCandidates(coreBlockTypes);
  cachedResponse = candidates.map(buildThemeBlocksResponseEntry);
  return cachedResponse;
}
