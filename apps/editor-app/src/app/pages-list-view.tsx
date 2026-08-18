import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '../components/ui/button.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { usePagesList } from './use-pages-list.js';

export interface PagesListViewProps {
  siteId: string;
  pages: PageDto[];
}

export function PagesListView({ siteId, pages }: PagesListViewProps) {
  const { createPage } = usePagesList(siteId);
  const [error, setError] = useState('');

  async function handleCreatePage() {
    setError('');
    try {
      await createPage();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pagine</h1>
        <Button onClick={() => void handleCreatePage()}>Nuova pagina</Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna pagina ancora.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {pages.map((page) => (
            <li key={page.id}>
              <Link
                to="/pages/$pageId"
                params={{ pageId: page.id }}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted"
              >
                <span>{page.slug}</span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  <span>
                    {page.status === 'published' ? 'Pubblicata' : 'Bozza'}
                  </span>
                  <span>
                    {new Date(page.updatedAt).toLocaleDateString('it-IT')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
