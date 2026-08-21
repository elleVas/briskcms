import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { ExternalLink, History, Languages, Search } from 'lucide-react';
import { pageBlockCategories, pageBlocks } from '@brisk/block-registry';
import { CanvasEditorShell } from './canvas/canvas-editor-shell.js';
import { FormListProvider } from './form-list-provider.js';
import { IconButton } from './icon-button.js';
import { MediaPickerProvider } from './media-picker-provider.js';
import { PageSwitcher } from './page-switcher.js';
import { PageTranslationsDialog } from './page-translations-dialog.js';
import { SeoPanelDialog } from './seo-panel-dialog.js';
import { PUBLIC_SITE_URL } from '../lib/public-site-url.js';
import { usePageEditor, type SaveStatus } from './use-page-editor.js';
import { usePageVersions } from './use-page-versions.js';
import { VersionHistoryDialog } from './version-history-dialog.js';

// Mirrors apps/public-site/src/lib/locale-path.ts's own convention (docs/adr/0017)
// — every locale gets a URL prefix, and "home" collapses to the bare
// locale root rather than a literal /home.
function publicPagePath(locale: string, slug: string): string {
  return slug === 'home' ? `/${locale}/` : `/${locale}/${slug}`;
}

export interface PageEditorViewProps {
  pageId: string;
}

function useStatusText(status: SaveStatus): string {
  const { t } = useTranslation();
  switch (status.kind) {
    case 'idle':
      return '';
    case 'saved':
      return t('pages.editor.draftSaved');
    case 'published':
      return t('pages.editor.published');
    case 'error':
      return status.message;
  }
}

export function PageEditorView({ pageId }: PageEditorViewProps) {
  const { t } = useTranslation();
  const { page, status, handleChange, handlePublish } = usePageEditor(pageId);
  const statusText = useStatusText(status);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [isTranslationsOpen, setIsTranslationsOpen] = useState(false);
  const [restoredAt, setRestoredAt] = useState(0);
  const {
    versions,
    isLoading: isLoadingVersions,
    rollback,
  } = usePageVersions(pageId, isHistoryOpen);

  async function handleRollback(versionId: string) {
    await rollback(versionId);
    setRestoredAt((n) => n + 1);
  }

  return (
    // The whole view (not just the canvas) is wrapped in MediaPickerProvider:
    // SeoPanelDialog's OG-image field reuses the same media picker as the
    // Image/Gallery blocks, and it lives in the top bar, outside the
    // canvas. FormListProvider only backs the Form block inside the canvas,
    // but nesting it here too keeps both providers alongside each other
    // rather than splitting the wrapping between two different levels.
    <MediaPickerProvider siteId={page.siteId}>
      <FormListProvider siteId={page.siteId}>
        <CanvasEditorShell
          backLink={
            <Link to="/pages" className="hover:underline">
              ← {t('pages.editor.backToList')}
            </Link>
          }
          pageSwitcher={
            <PageSwitcher
              siteId={page.siteId}
              currentPageId={pageId}
              currentLabel={page.slug}
            />
          }
          siteId={page.siteId}
          statusText={statusText}
          actions={
            <>
              <IconButton
                label={t('pages.seo.open')}
                onClick={() => setIsSeoOpen(true)}
              >
                <Search />
              </IconButton>
              <IconButton
                label={t('pages.versionHistory.open')}
                onClick={() => setIsHistoryOpen(true)}
              >
                <History />
              </IconButton>
              <IconButton
                label={t('pages.translations.open')}
                onClick={() => setIsTranslationsOpen(true)}
              >
                <Languages />
              </IconButton>
              {/* Only once there's something live to see — a draft-only page
                  would just 404 on the public site (see get-published-page-by-
                  slug.use-case.ts: unpublished and nonexistent are the same). */}
              {page.status === 'published' && (
                <IconButton label={t('pages.editor.viewPage')} asChild>
                  <a
                    href={`${PUBLIC_SITE_URL}${publicPagePath(page.locale, page.slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                  </a>
                </IconButton>
              )}
            </>
          }
          registry={pageBlocks}
          categories={pageBlockCategories}
          blocks={page.content}
          onChange={handleChange}
          onPublish={handlePublish}
          pageId={pageId}
          restoredAt={restoredAt}
        >
          <VersionHistoryDialog
            versions={versions}
            isLoading={isLoadingVersions}
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            onRollback={handleRollback}
          />
          <SeoPanelDialog
            pageId={pageId}
            seoMeta={page.seoMeta}
            open={isSeoOpen}
            onOpenChange={setIsSeoOpen}
          />
          <PageTranslationsDialog
            pageId={pageId}
            siteId={page.siteId}
            slug={page.slug}
            open={isTranslationsOpen}
            onOpenChange={setIsTranslationsOpen}
          />
        </CanvasEditorShell>
      </FormListProvider>
    </MediaPickerProvider>
  );
}
