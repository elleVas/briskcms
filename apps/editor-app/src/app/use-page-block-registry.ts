import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pageBlockCategories, pageBlocks } from '@brisk/block-registry';
import { mergeThemeBlocks, type PageBlockRegistry } from './merge-theme-blocks';
import { themeBlockVariantsQueryOptions } from './theme-block-variants-queries';
import { themePageBlocksQueryOptions } from './theme-page-blocks-queries';
import { themeStylePropertiesQueryOptions } from './theme-style-properties-queries';
import { useActiveThemeName } from './use-active-theme-name';

/**
 * Docs/adr/0041 — the one integration point `page-group-editor-view.tsx`
 * needs: replaces its old static `registry={pageBlocks}` /
 * `categories={pageBlockCategories}` props with this hook's output. Falls
 * back to the core-only registry (`data` undefined) while the query is
 * still in flight — `CanvasEditorShell` already renders fine with just
 * the core blocks, so there's no loading state to design for here, a
 * theme block just appears in the picker a moment after everything else.
 */
export function usePageBlockRegistry(): PageBlockRegistry {
  const themeName = useActiveThemeName();
  const { data } = useQuery(themePageBlocksQueryOptions(themeName));
  // The looks a theme adds to CORE types (ADR-0047) — a separate query
  // from the one above, which brings its own new types: they answer
  // different questions and a theme commonly has one and not the other.
  const { data: themeVariants } = useQuery(
    themeBlockVariantsQueryOptions(themeName),
  );
  // ...and what it added to core's style vocabulary (ADR-0047): a third
  // question, and a theme commonly answers one of the three and not the
  // others.
  const { data: themeStyleProperties } = useQuery(
    themeStylePropertiesQueryOptions(themeName),
  );
  return useMemo(
    () =>
      mergeThemeBlocks(
        pageBlocks,
        pageBlockCategories,
        data ?? [],
        themeVariants ?? {},
        themeStyleProperties ?? {},
      ),
    [data, themeVariants, themeStyleProperties],
  );
}
