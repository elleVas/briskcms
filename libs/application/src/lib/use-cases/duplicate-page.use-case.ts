import { randomUUID } from 'node:crypto';
import {
  Page,
  PageNotFoundError,
  PageSlugAlreadyExistsError,
} from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface DuplicatePageDeps {
  pageRepository: PageRepositoryPort;
}

export interface DuplicatePageInput {
  tenantId: string;
  sourcePageId: string;
  slug: string;
  title: string;
  description: string;
  createdBy: string | null;
}

/**
 * Copia una pagina esistente in una pagina nuova e indipendente — non una
 * traduzione (vedi createPageTranslation): `groupId` nuovo, non quello della
 * sorgente. Il duplicato eredita `parentId` (stesso posto nella gerarchia,
 * come sibling), `content` e il resto di `seoMeta` (ogTags/canonical) dalla
 * sorgente, ma con `title`/`description`/`slug` scelti dall'utente nel
 * pannello di duplicazione — mai `publishedContent`/`status`: passando da
 * `Page.create()` il duplicato parte sempre come bozza, anche se la
 * sorgente è pubblicata.
 */
export async function duplicatePage(
  deps: DuplicatePageDeps,
  input: DuplicatePageInput,
): Promise<Page> {
  const source = await deps.pageRepository.findById(
    input.tenantId,
    input.sourcePageId,
  );
  if (!source) {
    throw new PageNotFoundError(input.sourcePageId);
  }

  const slugTaken = await deps.pageRepository.findBySlug(
    input.tenantId,
    source.siteId,
    source.locale,
    input.slug,
  );
  if (slugTaken) {
    throw new PageSlugAlreadyExistsError(input.slug);
  }

  const duplicate = Page.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: source.siteId,
    groupId: randomUUID(),
    locale: source.locale,
    slug: input.slug,
    parentId: source.parentId,
    seoMeta: {
      ...source.seoMeta,
      title: input.title,
      description: input.description,
    },
    content: source.content,
  });

  await deps.pageRepository.saveWithVersion(duplicate, {
    id: randomUUID(),
    tenantId: duplicate.tenantId,
    pageId: duplicate.id,
    content: duplicate.content,
    createdBy: input.createdBy,
    createdAt: duplicate.updatedAt,
  });

  return duplicate;
}
