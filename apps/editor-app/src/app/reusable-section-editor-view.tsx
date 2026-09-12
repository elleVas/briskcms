import { Link } from '@tanstack/react-router';
import { pageBlockCategories, pageBlocks } from '@brisk/block-registry';
import { useTranslation } from '../lib/use-translation';
import { useSaveStatusText } from './save-status-text';
import { CanvasEditorShell } from './canvas/canvas-editor-shell';
import { IconListProvider } from './icon-list-provider';
import { MediaPickerProvider } from './media-picker-provider';
import { PageListProvider } from './page-list-provider';
import { useReusableSectionEditor } from './use-reusable-section-editor';

export interface ReusableSectionEditorViewProps {
  sectionId: string;
  siteId: string;
  /** A section has no locale of its own — this is the one its links resolve in. */
  locale: string;
}

/**
 * A section is edited on its own screen, never in place on a page
 * (docs/adr/0059). Elementor and Webflow both do it this way, and for the
 * reason that decided it here: editing in place on a page used by eight
 * others is how an accidental change to all eight happens.
 *
 * The full page-block registry, not a reduced one: a section is a strip of
 * an ordinary page, so anything that can go on a page can go in one.
 */
export function ReusableSectionEditorView({
  sectionId,
  siteId,
  locale,
}: ReusableSectionEditorViewProps) {
  const { t } = useTranslation();
  const {
    section,
    status,
    isSaving,
    handleChange,
    handlePublish,
    toggleExposedField,
  } = useReusableSectionEditor(sectionId);
  const statusText = useSaveStatusText(status, {
    publishedKey: 'sections.published',
  });

  return (
    <MediaPickerProvider siteId={siteId}>
      <PageListProvider siteId={siteId} locale={locale}>
        <IconListProvider>
          <CanvasEditorShell
            backLink={
              <Link to="/sections" className="hover:underline">
                {t('sections.backToList')}
              </Link>
            }
            siteId={siteId}
            statusText={statusText}
            isSaving={isSaving}
            registry={pageBlocks}
            categories={pageBlockCategories}
            blocks={section.content}
            onChange={handleChange}
            onPublish={handlePublish}
            // No page is involved: the canvas renders the section's own
            // preview route instead (see CanvasFrame.sectionPreview). The
            // section's id stands in for `pageId`, which nothing reads
            // while `sectionPreview` is set.
            pageId={section.id}
            sectionPreview={{ sectionId: section.id, locale }}
            sectionEditing={{
              exposedFields: section.exposedFields,
              onToggleField: toggleExposedField,
            }}
          />
        </IconListProvider>
      </PageListProvider>
    </MediaPickerProvider>
  );
}
