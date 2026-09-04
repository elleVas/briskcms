import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { History } from 'lucide-react';
import { headerFooterBlocks } from '@brisk/block-registry';
import type { SaveStatus } from './save-status';
import { CanvasEditorShell } from './canvas/canvas-editor-shell';
import { IconButton } from './icon-button';
import { IconListProvider } from './icon-list-provider';
import { MediaPickerProvider } from './media-picker-provider';
import { PageListProvider } from './page-list-provider';
import type { SiteLayoutSectionKind } from '../lib/site-layout-sections-api-client';
import { Switch } from '../components/ui/switch';
import { useRepresentativePage } from './use-representative-page';
import { useSiteLayoutSectionEditor } from './use-site-layout-section-editor';
import { useSiteLayoutSectionVersions } from './use-site-layout-section-versions';
import { VersionHistoryDialog } from './version-history-dialog';

// The header and footer share a single registry (docs/adr/0018, see the
// comment on headerFooterBlocks itself) — no separate categorization exists
// for them yet, and a single "Blocks" section is enough while the registry
// stays small (12 types).
const headerFooterCategories = [
  {
    title: 'blocks.categories.headerFooter',
    types: headerFooterBlocks.map((block) => block.type),
  },
];

export interface SiteLayoutSectionEditorViewProps {
  siteId: string;
  locale: string;
  kind: SiteLayoutSectionKind;
}

function useStatusText(status: SaveStatus): string {
  const { t } = useTranslation();
  switch (status.kind) {
    case 'idle':
      return '';
    case 'saved':
      return t('layout.editor.draftSaved');
    case 'published':
      return t('layout.editor.published');
    case 'error':
      return status.message;
  }
}

/**
 * A single generic view for both Header and Footer (docs/adr/0018), not
 * two near-identical components — they share the exact same lifecycle,
 * only the `kind` (and therefore the query/mutations it drives) differs.
 */
export function SiteLayoutSectionEditorView({
  siteId,
  locale,
  kind,
}: SiteLayoutSectionEditorViewProps) {
  const { t } = useTranslation();
  const { section, status, handleChange, handlePublish, handleStickyChange } =
    useSiteLayoutSectionEditor(siteId, locale, kind);
  const statusText = useStatusText(status);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [restoredAt, setRestoredAt] = useState(0);
  const {
    versions,
    isLoading: isLoadingVersions,
    rollback,
  } = useSiteLayoutSectionVersions(
    section.id,
    siteId,
    locale,
    kind,
    isHistoryOpen,
  );
  // canvas-editor-shell.tsx always renders the real Astro canvas of ONE
  // PAGE (see canvas-frame.tsx) — the header and footer have none of their
  // own, so a representative one in the same language is needed as the
  // backdrop to show the header/footer being edited against.
  const { page: representativePage, isLoading: isLoadingRepresentativePage } =
    useRepresentativePage(siteId, locale);

  async function handleRollback(versionId: string) {
    await rollback(versionId);
    setRestoredAt((n) => n + 1);
  }

  const sectionLabel =
    kind === 'header' ? t('layout.editHeader') : t('layout.editFooter');

  return (
    <MediaPickerProvider siteId={siteId}>
      <PageListProvider siteId={siteId} locale={locale}>
        <IconListProvider>
          {!isLoadingRepresentativePage && !representativePage ? (
            <div className="flex h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {t('layout.editor.noPageToPreview', { section: sectionLabel })}
            </div>
          ) : (
            representativePage && (
              <CanvasEditorShell
                backLink={
                  <Link to="/layout" className="hover:underline">
                    ← {t('layout.editor.backToList')}
                  </Link>
                }
                siteId={siteId}
                statusText={statusText}
                actions={
                  <>
                    {kind === 'header' && (
                      <label className="flex items-center gap-1.5">
                        <Switch
                          size="sm"
                          checked={section.sticky}
                          onCheckedChange={handleStickyChange}
                        />
                        {t('layout.editor.sticky')}
                      </label>
                    )}
                    <IconButton
                      label={t('pages.versionHistory.open')}
                      onClick={() => setIsHistoryOpen(true)}
                    >
                      <History />
                    </IconButton>
                  </>
                }
                registry={headerFooterBlocks}
                categories={headerFooterCategories}
                blocks={section.content}
                onChange={handleChange}
                onPublish={handlePublish}
                pageId={representativePage.id}
                editingSection={kind}
                restoredAt={restoredAt}
              >
                <VersionHistoryDialog
                  versions={versions}
                  isLoading={isLoadingVersions}
                  open={isHistoryOpen}
                  onOpenChange={setIsHistoryOpen}
                  onRollback={handleRollback}
                />
              </CanvasEditorShell>
            )
          )}
        </IconListProvider>
      </PageListProvider>
    </MediaPickerProvider>
  );
}
