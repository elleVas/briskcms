import { randomUUID } from 'node:crypto';
import {
  PageGroup,
  PageGroupNotFoundError,
  PageTranslation,
} from '@brisk/domain-core';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
} from '@brisk/ports';
import { findAvailableSlug } from './find-available-slug';

export interface DuplicatePageGroupDeps {
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
}

export interface DuplicatePageGroupInput {
  tenantId: string;
  sourceGroupId: string;
  createdBy: string | null;
}

export interface DuplicatePageGroupResult {
  group: PageGroup;
  translations: PageTranslation[];
}

// `${baseSlug}-copy`, then `-copy-2`, `-copy-3`, ...
function buildCopySlugCandidate(baseSlug: string, attempt: number): string {
  return attempt === 1 ? `${baseSlug}-copy` : `${baseSlug}-copy-${attempt}`;
}

/**
 * Duplicates a whole PageGroup — the shared structure AND every one of its
 * translations, not just one locale (see the old duplicatePage's own doc
 * comment for why that was the old model's unit: a "page" there WAS one
 * locale). The duplicate is a sibling of the source (same `parentId`,
 * appended order), starts fully independent (new ids throughout), and
 * every translation starts as an unpublished draft even if its source was
 * published — same reasoning as the old model. `seoMeta.title` is copied
 * verbatim (no locale-aware "(copy)" suffix is available to an
 * application-layer use-case); only `slug` gets a suffix, since it must
 * be unique among the same siblings.
 */
export async function duplicatePageGroup(
  deps: DuplicatePageGroupDeps,
  input: DuplicatePageGroupInput,
): Promise<DuplicatePageGroupResult> {
  const source = await deps.pageGroupRepository.findById(
    input.tenantId,
    input.sourceGroupId,
  );
  if (!source) {
    throw new PageGroupNotFoundError(input.sourceGroupId);
  }

  const sourceTranslations = await deps.pageTranslationRepository.listByGroup(
    input.tenantId,
    source.id,
  );

  const siblings = await deps.pageGroupRepository.listSiblings(
    input.tenantId,
    source.siteId,
    source.parentId,
  );
  const order = Math.max(-1, ...siblings.map((sibling) => sibling.order)) + 1;

  const group = PageGroup.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: source.siteId,
    parentId: source.parentId,
    content: source.content,
    order,
    createdBy: input.createdBy,
  });
  await deps.pageGroupRepository.saveWithVersion(group, {
    id: randomUUID(),
    tenantId: group.tenantId,
    pageGroupId: group.id,
    content: group.content,
    createdBy: input.createdBy,
    createdAt: group.updatedAt,
  });

  const translations: PageTranslation[] = [];
  for (const sourceTranslation of sourceTranslations) {
    const slug = await findAvailableSlug(
      deps.pageTranslationRepository,
      input.tenantId,
      group.siteId,
      sourceTranslation.locale,
      group.parentId,
      sourceTranslation.slug,
      buildCopySlugCandidate,
    );
    const translation = PageTranslation.fromProps({
      id: randomUUID(),
      tenantId: input.tenantId,
      siteId: group.siteId,
      pageGroupId: group.id,
      locale: sourceTranslation.locale,
      slug,
      seoMeta: sourceTranslation.seoMeta,
      fieldValues: sourceTranslation.fieldValues,
      status: 'draft',
      publishedSnapshot: null,
      isDiverged: sourceTranslation.isDiverged,
      divergedContent: sourceTranslation.divergedContent,
      createdBy: input.createdBy,
      createdAt: group.updatedAt,
      updatedAt: group.updatedAt,
    });
    await deps.pageTranslationRepository.save(translation, group.parentId);
    translations.push(translation);
  }

  return { group, translations };
}
