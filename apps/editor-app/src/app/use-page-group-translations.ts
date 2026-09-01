import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageGroupTranslation } from '../lib/page-groups-api-client';
import { pageGroupTranslationsQueryOptions } from './page-groups-queries';

export interface CreatePageGroupTranslationForLocale {
  locale: string;
  slug: string;
}

/**
 * Backs the translations-management dialog's one real new capability: the
 * LanguageSwitcher (canvas/language-switcher.tsx) can only move between
 * translations that already exist — there was previously no way at all to
 * add a translation for a locale the group doesn't have yet from inside
 * the editor (the old page-translations-dialog.tsx's "mark synced"/drift
 * feature has no equivalent here: a linked translation can't structurally
 * drift under the shared-structure model, so it isn't reproduced).
 */
export function usePageGroupTranslations(groupId: string) {
  const queryClient = useQueryClient();

  const createTranslationMutation = useMutation({
    mutationFn: (input: CreatePageGroupTranslationForLocale) =>
      createPageGroupTranslation(groupId, {
        locale: input.locale,
        slug: input.slug,
        seoMeta: { title: '', description: '' },
      }),
    onSuccess: (created) => {
      queryClient.setQueryData(
        pageGroupTranslationsQueryOptions(groupId).queryKey,
        (prev) => [...(prev ?? []), created],
      );
    },
  });

  return {
    createTranslation: createTranslationMutation.mutateAsync,
    isCreating: createTranslationMutation.isPending,
  };
}
