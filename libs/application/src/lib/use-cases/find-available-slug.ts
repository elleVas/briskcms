import { randomUUID } from 'node:crypto';
import type { PageTranslationRepositoryPort } from '@brisk/ports';

const MAX_SLUG_SUFFIX_ATTEMPTS = 50;

/**
 * Resolves the first slug `buildCandidate(baseSlug, attempt)` produces
 * (attempt starting at 1) that no sibling of this (site, locale,
 * parentGroupId) already has — same sibling-scoped uniqueness
 * createPageGroupTranslation itself enforces (ADR-0029), just resolved
 * proactively here instead of retried after a 409. Extracted from
 * duplicate-page-group.use-case.ts (its own `-copy`/`-copy-N` suffix is
 * now `buildCandidate` there) so generate-legal-documents.use-case.ts can
 * reuse the same resolution loop with its own `-2`/`-3` suffix instead of
 * a second hand-copied implementation.
 */
export async function findAvailableSlug(
  pageTranslationRepository: PageTranslationRepositoryPort,
  tenantId: string,
  siteId: string,
  locale: string,
  parentGroupId: string | null,
  baseSlug: string,
  buildCandidate: (baseSlug: string, attempt: number) => string,
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_SLUG_SUFFIX_ATTEMPTS; attempt++) {
    const candidate = buildCandidate(baseSlug, attempt);
    const taken =
      await pageTranslationRepository.findByParentGroupAndLocaleSlug(
        tenantId,
        siteId,
        locale,
        parentGroupId,
        candidate,
      );
    if (!taken) {
      return candidate;
    }
  }
  // Extremely unlikely at any real sibling-group size — falls back to a
  // slug guaranteed unique rather than looping forever.
  return `${baseSlug}-${randomUUID().slice(0, 8)}`;
}
