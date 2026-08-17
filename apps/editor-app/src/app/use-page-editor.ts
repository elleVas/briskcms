import { useCallback, useEffect, useRef, useState } from 'react';
import type { Data } from '@puckeditor/core';
import { fromPuckData } from '../lib/puck-data-mapper.js';
import {
  createPage,
  getPage,
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
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pageId = params.get('pageId');

    if (pageId) {
      getPage(pageId)
        .then((loaded) => {
          setPage(loaded);
          setStatus('');
        })
        .catch((error: unknown) => setStatus(String(error)));
      return;
    }

    createPage({
      siteId: DEFAULT_SITE_ID,
      groupId: crypto.randomUUID(),
      locale: 'it',
      slug: `pagina-${Date.now()}`,
      seoMeta: { title: 'Nuova pagina', description: '' },
    })
      .then((created) => {
        const url = new URL(window.location.href);
        url.searchParams.set('pageId', created.id);
        window.history.replaceState({}, '', url);
        setPage(created);
        setStatus('');
      })
      .catch((error: unknown) => setStatus(String(error)));
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

  return { page, status, handleChange, handlePublish };
}
