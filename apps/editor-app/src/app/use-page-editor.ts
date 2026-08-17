import { useCallback, useEffect, useRef, useState } from 'react';
import type { Data } from '@puckeditor/core';
import { fromPuckData } from '../lib/puck-data-mapper.js';
import {
  ApiError,
  createPage,
  getPage,
  login as apiLogin,
  logout as apiLogout,
  publishPage,
  saveDraft,
  type PageDto,
} from '../lib/pages-api-client.js';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

// Draft autosave is debounced: Puck's onChange fires on every keystroke, and
// every draft save creates a page_versions row (see domain-core Page) — no
// debounce would flood the version history with one row per character typed.
const DRAFT_SAVE_DEBOUNCE_MS = 1000;

export function usePageEditor() {
  const [page, setPage] = useState<PageDto | null>(null);
  const [status, setStatus] = useState('Caricamento...');
  const [needsLogin, setNeedsLogin] = useState(false);
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  // No synchronous setState at the top here on purpose (react-hooks/set-
  // state-in-effect flags that when a function is called straight from an
  // effect body, see the mount effect below) — resetting needsLogin/status
  // before a *re*-load only matters for the handleLogin caller, which does
  // it itself; on mount the defaults already match.
  const loadOrCreatePage = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const pageId = params.get('pageId');

    const loaded = pageId
      ? getPage(pageId)
      : createPage({
          siteId: DEFAULT_SITE_ID,
          groupId: crypto.randomUUID(),
          locale: 'it',
          slug: `pagina-${Date.now()}`,
          seoMeta: { title: 'Nuova pagina', description: '' },
        });

    loaded
      .then((result) => {
        if (!pageId) {
          const url = new URL(window.location.href);
          url.searchParams.set('pageId', result.id);
          window.history.replaceState({}, '', url);
        }
        setPage(result);
        setStatus('');
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          setNeedsLogin(true);
          setStatus('');
          return;
        }
        setStatus(String(error));
      });
  }, []);

  useEffect(() => {
    loadOrCreatePage();
  }, [loadOrCreatePage]);

  // Errors intentionally propagate to the caller (LoginForm shows them) —
  // this hook only re-triggers the page load once login actually succeeds.
  const handleLogin = useCallback(
    async (email: string, password: string) => {
      await apiLogin(email, password);
      setNeedsLogin(false);
      setStatus('Caricamento...');
      loadOrCreatePage();
    },
    [loadOrCreatePage],
  );

  // Best-effort: even if the server call fails (e.g. the session already
  // expired), the user still gets kicked back to the login screen locally —
  // the `catch` here is what actually makes it best-effort; a bare
  // `finally` would still leave the rejection unhandled.
  const handleLogout = useCallback(async () => {
    window.clearTimeout(saveTimeoutRef.current);
    try {
      await apiLogout();
    } catch {
      // ignored on purpose, see comment above
    } finally {
      setPage(null);
      setNeedsLogin(true);
      setStatus('');
    }
  }, []);

  const handleChange = useCallback(
    (data: Data) => {
      if (!page) return;
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        saveDraft(page.id, fromPuckData(data))
          .then(() => setStatus('Bozza salvata'))
          .catch((error: unknown) => setStatus(String(error)));
      }, DRAFT_SAVE_DEBOUNCE_MS);
    },
    [page],
  );

  const handlePublish = useCallback(
    async (data: Data) => {
      if (!page) return;
      window.clearTimeout(saveTimeoutRef.current);
      await saveDraft(page.id, fromPuckData(data));
      await publishPage(page.id);
      setStatus('Pubblicato');
    },
    [page],
  );

  return {
    page,
    status,
    needsLogin,
    handleLogin,
    handleLogout,
    handleChange,
    handlePublish,
  };
}
