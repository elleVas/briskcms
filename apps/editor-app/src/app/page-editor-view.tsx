import { Link } from '@tanstack/react-router';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { puckConfig } from '@brisk/puck-config';
import { toPuckData } from '../lib/puck-data-mapper.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { LogoutButton } from './logout-button.js';
import { usePageEditor } from './use-page-editor.js';

export interface PageEditorViewProps {
  page: PageDto;
}

export function PageEditorView({ page: initialPage }: PageEditorViewProps) {
  const { page, status, handleChange, handlePublish } =
    usePageEditor(initialPage);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between border-b px-3 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <Link to="/pages" className="hover:underline">
            ← Pagine
          </Link>
          <span>{status}</span>
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
