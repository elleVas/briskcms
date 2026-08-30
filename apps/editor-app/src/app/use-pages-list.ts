import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { slugify } from '@brisk/shared-types';
import {
  createPage as apiCreatePage,
  deletePage as apiDeletePage,
  duplicatePage as apiDuplicatePage,
  publishPage as apiPublishPage,
  setPageParent as apiSetPageParent,
  type DuplicatePageInput,
} from '../lib/pages-api-client';

// Fetching the list itself is the route loader's job (see
// routes/_shell.pages.index.tsx) so the auth guard (redirect to /login on a
// 401) lives in one place — this hook only owns the actions available from
// the pages list screen: create, delete, publish.
export function usePagesList(siteId: string, defaultLocale: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // A partial key ('pages', siteId) invalidates every cached page of
  // results for this site (see pages-queries.ts — the full key also
  // includes the page number), not just whichever page is on screen right
  // now.
  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['pages', siteId] }),
    [queryClient, siteId],
  );

  const createPageMutation = useMutation({
    // `name` is what the user typed in NewPageDialog; the slug is always
    // derived from it (see @brisk/shared-types#slugify), never chosen
    // separately, so the URL and the display name can never disagree. A
    // brand-new page starts its own translation group of one (docs/adr/0017)
    // — `createPageTranslation` is the only path that reuses a `groupId`.
    mutationFn: ({
      name,
      parentId,
    }: {
      name: string;
      parentId: string | null;
    }) =>
      apiCreatePage({
        siteId,
        groupId: crypto.randomUUID(),
        locale: defaultLocale,
        slug: slugify(name),
        parentId,
        seoMeta: { title: name, description: '' },
      }),
    onSuccess: async (page) => {
      await invalidateList();
      await navigate({ to: '/pages/$pageId', params: { pageId: page.id } });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: string) => apiDeletePage(pageId),
    onSuccess: invalidateList,
  });

  const publishPageMutation = useMutation({
    mutationFn: (pageId: string) => apiPublishPage(pageId),
    onSuccess: invalidateList,
  });

  const duplicatePageMutation = useMutation({
    mutationFn: ({
      pageId,
      input,
    }: {
      pageId: string;
      input: DuplicatePageInput;
    }) => apiDuplicatePage(pageId, input),
    onSuccess: async (page) => {
      await invalidateList();
      await navigate({ to: '/pages/$pageId', params: { pageId: page.id } });
    },
  });

  const setPageParentMutation = useMutation({
    mutationFn: ({
      pageId,
      parentId,
    }: {
      pageId: string;
      parentId: string | null;
    }) => apiSetPageParent(pageId, parentId),
    onSuccess: invalidateList,
  });

  return {
    createPage: (name: string, parentId: string | null) =>
      createPageMutation.mutateAsync({ name, parentId }),
    isCreating: createPageMutation.isPending,
    deletePage: deletePageMutation.mutateAsync,
    isDeleting: deletePageMutation.isPending,
    duplicatePage: (pageId: string, input: DuplicatePageInput) =>
      duplicatePageMutation.mutateAsync({ pageId, input }),
    isDuplicating: duplicatePageMutation.isPending,
    publishPage: publishPageMutation.mutateAsync,
    isPublishing: publishPageMutation.isPending,
    setPageParent: (pageId: string, parentId: string | null) =>
      setPageParentMutation.mutateAsync({ pageId, parentId }),
    isSettingParent: setPageParentMutation.isPending,
  };
}
