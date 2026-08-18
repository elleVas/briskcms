import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { ExternalLink, History } from 'lucide-react';
import { puckConfig } from '@brisk/puck-config';
import { toPuckData } from '../lib/puck-data-mapper.js';
import { IconButton } from './icon-button.js';
import { LogoutButton } from './logout-button.js';
import { usePageEditor, type SaveStatus } from './use-page-editor.js';
import { VersionHistoryDialog } from './version-history-dialog.js';

// Not VITE_API_URL: this is the public site's own origin (apps/public-site).
// Same fallback pattern as VITE_API_URL in http-client.ts — a sane local-dev
// default, always overridden by a real domain outside dev.
const PUBLIC_SITE_URL =
  (import.meta.env['VITE_PUBLIC_SITE_URL'] as string | undefined) ??
  'http://localhost:4321';

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
  // Bumped only on an explicit rollback, never on ordinary autosave — see
  // the comment on <Puck key={...}> below for why it can't be page.updatedAt.
  const [restoredAt, setRestoredAt] = useState(0);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between border-b px-3 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <Link to="/pages" className="hover:underline">
            ← {t('pages.editor.backToList')}
          </Link>
          <span>{statusText}</span>
          <IconButton
            label={t('pages.versionHistory.open')}
            onClick={() => setIsHistoryOpen(true)}
          >
            <History />
          </IconButton>
          {/* Only once there's something live to see — a draft-only page
              would just 404 on the public site (see get-published-page-by-
              slug.use-case.ts: unpublished and nonexistent are the same). */}
          {page.status === 'published' && (
            <IconButton label={t('pages.editor.viewPage')} asChild>
              <a
                href={`${PUBLIC_SITE_URL}/${page.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
              </a>
            </IconButton>
          )}
        </div>
        <LogoutButton />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {/* Keyed on restoredAt, NOT page.updatedAt: every autosave also
            bumps page.updatedAt (saveDraft's onSuccess writes the fresh
            page into the query cache), and keying on that remounted Puck
            on every save — wiping in-progress edits, e.g. a block mid-drag
            — instead of only after a rollback like intended. */}
        <Puck
          key={restoredAt}
          config={puckConfig}
          data={toPuckData(page.content)}
          onChange={handleChange}
          onPublish={handlePublish}
        />
      </div>
      <VersionHistoryDialog
        pageId={pageId}
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        onRestored={() => setRestoredAt((n) => n + 1)}
      />
    </div>
  );
}
