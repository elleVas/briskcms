import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createPage as apiCreatePage } from '../lib/pages-api-client.js';
import { pagesQueryOptions } from './pages-queries.js';

// Fetching the list itself is the route loader's job (see
// routes/_shell.pages.index.tsx) so the auth guard (redirect to /login on a
// 401) lives in one place — this hook only owns the "new page" action,
// which the loader can't express: an explicit click, not page-load data.
export function usePagesList(siteId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createPageMutation = useMutation({
    mutationFn: () =>
      apiCreatePage({
        siteId,
        groupId: crypto.randomUUID(),
        locale: 'it',
        slug: `pagina-${Date.now()}`,
        seoMeta: { title: 'Nuova pagina', description: '' },
      }),
    onSuccess: (page) => {
      queryClient.invalidateQueries({
        queryKey: pagesQueryOptions(siteId).queryKey,
      });
      return navigate({ to: '/pages/$pageId', params: { pageId: page.id } });
    },
  });

  return {
    // .mutate, not .mutateAsync: the caller doesn't await this (see
    // PagesListView) — the error is already surfaced reactively via
    // createError below, so a rejected mutateAsync promise would just
    // become an unhandled rejection nobody catches.
    createPage: createPageMutation.mutate,
    isCreating: createPageMutation.isPending,
    createError: createPageMutation.error,
  };
}
