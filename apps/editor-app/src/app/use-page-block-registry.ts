import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pageBlockCategories, pageBlocks } from '@brisk/block-registry';
import { mergeThemeBlocks, type PageBlockRegistry } from './merge-theme-blocks';
import { themePageBlocksQueryOptions } from './theme-page-blocks-queries';
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
  const { data } = useQuery(themePageBlocksQueryOptions(useActiveThemeName()));
  return useMemo(
    () => mergeThemeBlocks(pageBlocks, pageBlockCategories, data ?? []),
    [data],
  );
}
