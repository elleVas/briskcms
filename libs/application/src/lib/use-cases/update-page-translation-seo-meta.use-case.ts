import {
  PageTranslationNotFoundError,
  type PageTranslation,
} from '@brisk/domain-core';
import type { SeoMeta } from '@brisk/shared-types';
import type { PageTranslationRepositoryPort } from '@brisk/ports';

export interface UpdatePageTranslationSeoMetaDeps {
  pageTranslationRepository: PageTranslationRepositoryPort;
}

export interface UpdatePageTranslationSeoMetaInput {
  tenantId: string;
  pageTranslationId: string;
  seoMeta: SeoMeta;
  parentGroupId: string | null;
}

export async function updatePageTranslationSeoMeta(
  deps: UpdatePageTranslationSeoMetaDeps,
  input: UpdatePageTranslationSeoMetaInput,
): Promise<PageTranslation> {
  const translation = await deps.pageTranslationRepository.findById(
    input.tenantId,
    input.pageTranslationId,
  );
  if (!translation) {
    throw new PageTranslationNotFoundError(input.pageTranslationId);
  }

  translation.updateSeoMeta(input.seoMeta);
  await deps.pageTranslationRepository.save(translation, input.parentGroupId);

  return translation;
}
