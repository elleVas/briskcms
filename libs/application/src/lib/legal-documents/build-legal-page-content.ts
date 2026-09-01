import { randomUUID } from 'node:crypto';
import type { FieldValueOverlay, PageContent } from '@brisk/shared-types';
import type { LegalDocumentOutline } from './legal-document-section';

interface SectionBlockIds {
  headingId: string;
  paragraphIds: string[];
}

export interface BuiltLegalPage {
  content: PageContent;
  /**
   * Builds the `fieldValues` overlay for a DIFFERENT locale's outline of
   * the SAME document (including that locale's own draft-notice text) —
   * only valid because every locale's template produces the same
   * section/paragraph shape (docs/adr/0040: shared structure + per-locale
   * overlay, not diverged content, to keep version history). Returns
   * `null` if the other outline's shape doesn't match (defensive — every
   * template pair is authored to match, but a future template edit that
   * breaks symmetry should fail loudly, not silently drop text).
   */
  fieldValuesFor: (
    otherOutline: LegalDocumentOutline,
    otherDraftNoticeText: string,
  ) => FieldValueOverlay | null;
}

/**
 * Turns a generated outline into a real `PageContent` block tree: a
 * warning `Callout` (the "auto-generated draft" notice, docs/adr/0040)
 * followed by one `Heading` + one `Text` per paragraph, per section.
 * Block ids are generated once here and reused by `fieldValuesFor` for
 * every other locale of the same document — this is what makes the
 * shared-structure i18n model (ADR-0034) work for generated content.
 */
export function buildLegalPageContent(
  outline: LegalDocumentOutline,
  draftNoticeText: string,
): BuiltLegalPage {
  const calloutId = randomUUID();
  const content: PageContent = [
    {
      id: calloutId,
      type: 'Callout',
      props: { message: draftNoticeText, tone: 'warning' },
    },
  ];
  const sectionIds: SectionBlockIds[] = [];

  for (const section of outline.sections) {
    const headingId = randomUUID();
    content.push({
      id: headingId,
      type: 'Heading',
      props: { text: section.heading, level: 'h2' },
    });

    const paragraphIds: string[] = [];
    for (const paragraph of section.paragraphs) {
      const paragraphId = randomUUID();
      paragraphIds.push(paragraphId);
      content.push({
        id: paragraphId,
        type: 'Text',
        props: { body: paragraph },
      });
    }
    sectionIds.push({ headingId, paragraphIds });
  }

  function fieldValuesFor(
    otherOutline: LegalDocumentOutline,
    otherDraftNoticeText: string,
  ): FieldValueOverlay | null {
    if (otherOutline.sections.length !== sectionIds.length) {
      return null;
    }
    const overlay: FieldValueOverlay = {
      [calloutId]: { message: otherDraftNoticeText },
    };
    for (let i = 0; i < otherOutline.sections.length; i++) {
      const otherSection = otherOutline.sections[i];
      const ids = sectionIds[i];
      if (otherSection.paragraphs.length !== ids.paragraphIds.length) {
        return null;
      }
      overlay[ids.headingId] = { text: otherSection.heading };
      otherSection.paragraphs.forEach((paragraph, j) => {
        overlay[ids.paragraphIds[j]] = { body: paragraph };
      });
    }
    return overlay;
  }

  return { content, fieldValuesFor };
}
