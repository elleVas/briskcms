import {
  Page,
  PageHierarchyCycleError,
  PageHierarchyLocaleMismatchError,
  PageNotFoundError,
  PageSlugAlreadyExistsError,
} from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface SetPageParentDeps {
  pageRepository: PageRepositoryPort;
}

export interface SetPageParentInput {
  tenantId: string;
  pageId: string;
  parentId: string | null;
}

// Safety net only — real sites are 1-3 levels deep (see the "5-15 pagine
// per sito" assumption used throughout this codebase), this guards
// against an unexpected cycle looping forever rather than a realistic
// depth.
const MAX_ANCESTOR_WALK = 20;

/**
 * A separate use-case from saveDraft/publish on purpose, same reasoning
 * as updateSiteLayoutSectionSticky: a page's position in the hierarchy is
 * a structural setting, not content — it takes effect immediately, no
 * draft/publish staging, no page_versions row.
 */
export async function setPageParent(
  deps: SetPageParentDeps,
  input: SetPageParentInput,
): Promise<Page> {
  const page = await deps.pageRepository.findById(input.tenantId, input.pageId);
  if (!page) {
    throw new PageNotFoundError(input.pageId);
  }

  if (input.parentId !== null) {
    const parent = await deps.pageRepository.findById(
      input.tenantId,
      input.parentId,
    );
    if (!parent) {
      throw new PageNotFoundError(input.parentId);
    }
    if (parent.siteId !== page.siteId || parent.locale !== page.locale) {
      throw new PageHierarchyLocaleMismatchError(page.id, parent.id);
    }

    if (parent.id === page.id) {
      throw new PageHierarchyCycleError(page.id);
    }

    // Walk up from the proposed parent's own parent looking for page.id —
    // finding it would mean page is already an ancestor of its proposed
    // parent, i.e. the reassignment would create a cycle.
    let currentId: string | null = parent.parentId;
    for (let hops = 0; currentId !== null; hops += 1) {
      if (currentId === page.id) {
        throw new PageHierarchyCycleError(page.id);
      }
      if (hops >= MAX_ANCESTOR_WALK) {
        throw new PageHierarchyCycleError(page.id);
      }
      const current = await deps.pageRepository.findById(
        input.tenantId,
        currentId,
      );
      currentId = current?.parentId ?? null;
    }
  }

  // Slug uniqueness is sibling-scoped (schema.ts's `pages` unique
  // constraints) — reparenting doesn't change `page.slug` itself, but
  // moving it under a parent that already has a different child with that
  // same slug would collide there for the first time. Not needed when
  // `input.parentId === page.parentId` (no actual move), but harmless to
  // check unconditionally — it just re-finds `page` itself in that case,
  // filtered out by the id check below.
  const collidingSibling = await deps.pageRepository.findByParentAndSlug(
    input.tenantId,
    page.siteId,
    page.locale,
    input.parentId,
    page.slug,
  );
  if (collidingSibling && collidingSibling.id !== page.id) {
    throw new PageSlugAlreadyExistsError(page.slug);
  }

  page.setParent(input.parentId);
  await deps.pageRepository.save(page);

  return page;
}
