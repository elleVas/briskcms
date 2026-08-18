import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { createPage as apiCreatePage } from '../lib/pages-api-client.js';

// Fetching the list itself is the route loader's job (see
// routes/_shell.pages.index.tsx) so the auth guard (redirect to /login on a
// 401) lives in one place — this hook only owns the "new page" action,
// which the loader can't express: an explicit click, not page-load data.
export function usePagesList(siteId: string) {
  const navigate = useNavigate();

  const createPage = useCallback(async () => {
    const page = await apiCreatePage({
      siteId,
      groupId: crypto.randomUUID(),
      locale: 'it',
      slug: `pagina-${Date.now()}`,
      seoMeta: { title: 'Nuova pagina', description: '' },
    });
    await navigate({ to: '/pages/$pageId', params: { pageId: page.id } });
  }, [siteId, navigate]);

  return { createPage };
}
