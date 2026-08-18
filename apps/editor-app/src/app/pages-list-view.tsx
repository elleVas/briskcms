import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { usePagesList } from './use-pages-list.js';

export interface PagesListViewProps {
  siteId: string;
  pages: PageDto[];
}

export function PagesListView({ siteId, pages }: PagesListViewProps) {
  const { t, i18n } = useTranslation();
  const { createPage, isCreating, createError } = usePagesList(siteId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t('pages.list.title')}</h1>
        <Button disabled={isCreating} onClick={() => createPage()}>
          {t('pages.list.newPage')}
        </Button>
      </div>
      {createError && (
        <p role="alert" className="text-sm text-destructive">
          {String(createError)}
        </p>
      )}
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('pages.list.empty')}</p>
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
                <span className="flex items-center gap-3">
                  <Badge
                    variant={
                      page.status === 'published' ? 'default' : 'outline'
                    }
                  >
                    {page.status === 'published'
                      ? t('pages.list.statusPublished')
                      : t('pages.list.statusDraft')}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(page.updatedAt).toLocaleDateString(i18n.language)}
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
