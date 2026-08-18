import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { puckConfig } from '@brisk/puck-config';
import { toPuckData } from '../lib/puck-data-mapper.js';
import { LogoutButton } from './logout-button.js';
import { usePageEditor, type SaveStatus } from './use-page-editor.js';

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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between border-b px-3 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <Link to="/pages" className="hover:underline">
            ← {t('pages.editor.backToList')}
          </Link>
          <span>{statusText}</span>
        </div>
        <LogoutButton />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Puck
          config={puckConfig}
          data={toPuckData(page.content)}
          onChange={handleChange}
          onPublish={handlePublish}
        />
      </div>
    </div>
  );
}
