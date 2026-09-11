import type { Block } from '@brisk/shared-types';
import {
  createReusableSection,
  publishReusableSection,
} from '../../lib/reusable-sections-api-client';
import { useTranslation } from '../../lib/use-translation';

export interface UseMakeReusableSectionParams {
  siteId: string | undefined;
  selectedBlock: Block | null;
  /** Swaps the selected block for the instance, as one undoable step. */
  handleReplaceSelected: (replacement: Block & { id: string }) => void;
}

/**
 * "This strip belongs on other pages too" (docs/adr/0059).
 *
 * Creates a SHARED section from the selected block, publishes it, and
 * replaces the block with an instance pointing at it. Published straight
 * away rather than left as a draft: the page it was taken from would
 * otherwise lose that strip until somebody published the section, which
 * reads as the button having broken the page.
 *
 * A window.prompt for the name, deliberately: a name is the only thing this
 * needs, and a dialog with one field is more code for a worse interruption.
 */
export function useMakeReusableSection({
  siteId,
  selectedBlock,
  handleReplaceSelected,
}: UseMakeReusableSectionParams): () => Promise<void> {
  const { t } = useTranslation();

  // A plain function and not a `useCallback`: the React Compiler refuses to
  // optimise a component when a manual dependency list holds a value it
  // cannot prove stable (`selectedBlock` here), and it memoises this
  // perfectly well on its own.
  return async function handleMakeReusable(): Promise<void> {
    if (!siteId || !selectedBlock?.id) {
      return;
    }
    const name = window.prompt(t('sections.makeReusablePrompt'));
    if (!name?.trim()) {
      return;
    }
    try {
      const created = await createReusableSection({
        siteId,
        name: name.trim(),
        kind: 'shared',
        content: [selectedBlock],
      });
      await publishReusableSection(created.id);
      handleReplaceSelected({
        id: crypto.randomUUID(),
        type: 'Section',
        props: {
          section: { sectionId: created.id, sectionName: created.name },
        },
      });
    } catch (caught) {
      window.alert(
        String(caught).includes('409')
          ? t('sections.nameTaken')
          : String(caught),
      );
    }
  };
}
