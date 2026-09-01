import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { slugify } from '@brisk/shared-types';
import {
  createPageGroup as apiCreatePageGroup,
  createPageGroupTranslation as apiCreatePageGroupTranslation,
  deletePageGroup as apiDeletePageGroup,
  duplicatePageGroup as apiDuplicatePageGroup,
  reorderPageGroups as apiReorderPageGroups,
} from '../lib/page-groups-api-client';

/**
 * i18n a livello di campo (see the plan) — mirrors use-pages-list.ts's own
 * role for the new PageGroup model. Still narrower than the old model in
 * one way: creates only at ROOT level (no parent picker yet — see
 * page-groups-list-view.tsx's own comment) and only seeds the site's
 * default locale (the language switcher covers the rest once the group
 * exists). Duplicate and drag-reorder ARE wired up now (were the last two
 * tracked follow-ups from Fase 4).
 */
export function usePageGroupsList(siteId: string, defaultLocale: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Partial key: invalidates every cached filter/page combination for
  // this site's list (see page-groups-queries.ts, whose full key also
  // includes page/filters), not just whichever one is on screen right now.
  const invalidateList = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ['page-groups', 'list', siteId],
      }),
    [queryClient, siteId],
  );

  const createPageGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const group = await apiCreatePageGroup({ siteId });
      await apiCreatePageGroupTranslation(group.id, {
        locale: defaultLocale,
        slug: slugify(name),
        seoMeta: { title: name, description: '' },
      });
      return group;
    },
    onSuccess: async (group) => {
      await invalidateList();
      await navigate({
        to: '/page-groups/$groupId',
        params: { groupId: group.id },
      });
    },
  });

  const deletePageGroupMutation = useMutation({
    mutationFn: (groupId: string) => apiDeletePageGroup(groupId),
    onSuccess: invalidateList,
  });

  const duplicatePageGroupMutation = useMutation({
    mutationFn: (groupId: string) => apiDuplicatePageGroup(groupId),
    onSuccess: async (duplicate) => {
      await invalidateList();
      await navigate({
        to: '/page-groups/$groupId',
        params: { groupId: duplicate.id },
      });
    },
  });

  const reorderPageGroupsMutation = useMutation({
    mutationFn: ({
      parentId,
      orderedPageGroupIds,
    }: {
      parentId: string | null;
      orderedPageGroupIds: string[];
    }) => apiReorderPageGroups(siteId, parentId, orderedPageGroupIds),
    onSuccess: invalidateList,
  });

  return {
    createPageGroup: createPageGroupMutation.mutateAsync,
    isCreating: createPageGroupMutation.isPending,
    deletePageGroup: deletePageGroupMutation.mutateAsync,
    isDeleting: deletePageGroupMutation.isPending,
    duplicatePageGroup: duplicatePageGroupMutation.mutateAsync,
    isDuplicating: duplicatePageGroupMutation.isPending,
    reorderPageGroups: (
      parentId: string | null,
      orderedPageGroupIds: string[],
    ) =>
      reorderPageGroupsMutation.mutateAsync({ parentId, orderedPageGroupIds }),
  };
}
