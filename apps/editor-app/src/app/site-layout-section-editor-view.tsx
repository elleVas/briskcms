import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { History } from 'lucide-react';
import { headerFooterPuckConfig } from '@brisk/puck-config';
import { toPuckData } from '../lib/puck-data-mapper.js';
import type { SaveStatus } from './use-page-editor.js';
import { BlockEditorShell } from './block-editor-shell.js';
import { IconButton } from './icon-button.js';
import { MediaPickerProvider } from './media-picker-provider.js';
import { PageListProvider } from './page-list-provider.js';
import type { SiteLayoutSectionKind } from '../lib/site-layout-sections-api-client.js';
import { Switch } from '../components/ui/switch.js';
import { useSiteLayoutSectionEditor } from './use-site-layout-section-editor.js';
import { useSiteLayoutSectionVersions } from './use-site-layout-section-versions.js';
import { VersionHistoryDialog } from './version-history-dialog.js';

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

  async function handleRollback(versionId: string) {
    await rollback(versionId);
    setRestoredAt((n) => n + 1);
  }

  return (
    <MediaPickerProvider siteId={siteId}>
      <PageListProvider siteId={siteId} locale={locale}>
        <BlockEditorShell
          backLink={
            <Link to="/layout" className="hover:underline">
              ← {t('layout.editor.backToList')}
            </Link>
          }
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
          config={headerFooterPuckConfig}
          data={toPuckData(section.content, headerFooterPuckConfig)}
          onChange={handleChange}
          onPublish={handlePublish}
          restoredAt={restoredAt}
        >
          <VersionHistoryDialog
            versions={versions}
            isLoading={isLoadingVersions}
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            onRollback={handleRollback}
          />
        </BlockEditorShell>
      </PageListProvider>
    </MediaPickerProvider>
  );
}
