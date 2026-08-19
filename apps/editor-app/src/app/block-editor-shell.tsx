import type { ReactNode } from 'react';
import type { Config, Data } from '@puckeditor/core';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { LogoutButton } from './logout-button.js';

export interface BlockEditorShellProps {
  // Pre-rendered, not a `to`/`label` pair: keeps TanStack Router's own
  // type-safe <Link> (each caller knows its own real route) instead of
  // this shared shell trying to generically type every possible route.
  backLink: ReactNode;
  statusText: string;
  // Caller-specific top bar icon-buttons (SEO/translations/view-page for
  // pages, none yet for Header/Footer) — this shell owns only what every
  // Puck-backed editor has in common.
  actions?: ReactNode;
  config: Config;
  data: Data;
  onChange: (data: Data) => void;
  // `unknown`, not `void`: the real handlers are React Query mutations
  // that resolve with the updated entity — Puck itself never looks at the
  // return value, so this only needs to be broad enough to accept either.
  onPublish: (data: Data) => unknown;
  // Bumped only on an explicit rollback, never on ordinary autosave — see
  // the comment on <Puck key={...}> below for why it can't be keyed on
  // the entity's own updatedAt.
  restoredAt?: number;
  // Caller-specific dialogs (VersionHistoryDialog, SeoPanelDialog, ...).
  children?: ReactNode;
}

/**
 * The fullscreen Puck editor scaffold shared by pages (page-editor-view.tsx)
 * and Header/Footer (site-layout-section-editor-view.tsx) — same top bar
 * (back-link + status + actions + logout) and canvas, docs/adr/0018.
 */
export function BlockEditorShell({
  backLink,
  statusText,
  actions,
  config,
  data,
  onChange,
  onPublish,
  restoredAt = 0,
  children,
}: BlockEditorShellProps) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between border-b px-3 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {backLink}
          <span>{statusText}</span>
          {actions}
        </div>
        <LogoutButton />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {/* Keyed on restoredAt, NOT the entity's own updatedAt: every
            autosave also bumps updatedAt (saveDraft's onSuccess writes the
            fresh entity into the query cache), and keying on that would
            remount Puck on every save — wiping in-progress edits, e.g. a
            block mid-drag — instead of only after a rollback like intended. */}
        <Puck
          key={restoredAt}
          config={config}
          data={data}
          onChange={onChange}
          onPublish={onPublish}
        />
      </div>
      {children}
    </div>
  );
}
