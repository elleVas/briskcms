import {
  collectSectionReferences,
  resolveSectionBlocks,
  type PageContent,
} from '@brisk/shared-types';
import type { ReusableSectionRepositoryPort } from '@brisk/ports';

export interface ResolveSectionInstancesDeps {
  reusableSectionRepository: ReusableSectionRepositoryPort;
}

/**
 * Expands every `Section` block in one or more content trees into the
 * section's PUBLISHED blocks (docs/adr/0059).
 *
 * This is the mechanism the whole feature rests on. A page's published
 * snapshot stores the reference, never the blocks — so publishing a
 * section changes all eight pages that use it, with none of them
 * republished. Freezing the blocks into the snapshot instead would have
 * reproduced exactly the problem the section exists to solve.
 *
 * `publishedContent` and never `content`: a section's draft is as private
 * as a page's, and the alternative is that half-finished edits appear on
 * every page using it as they are typed.
 *
 * One batched read for all of them, and the same combined pass over page
 * content plus header plus footer that `resolvePageContentReferences`
 * does — a section referenced from two of the three costs one lookup.
 */
export async function resolveSectionInstances(
  deps: ResolveSectionInstancesDeps,
  tenantId: string,
  contents: PageContent[],
): Promise<PageContent[]> {
  const referenced = collectSectionReferences(contents);
  if (referenced.size === 0) {
    return contents;
  }
  const sections = await deps.reusableSectionRepository.findByIds(tenantId, [
    ...referenced,
  ]);
  const publishedById = new Map<string, PageContent>();
  for (const section of sections) {
    if (section.publishedContent) {
      publishedById.set(section.id, section.publishedContent);
    }
  }
  return contents.map((content) =>
    resolveSectionBlocks(content, publishedById),
  );
}
