import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover.js';
import { cn } from '../lib/utils.js';
import { pagesQueryOptions } from './pages-queries.js';

export interface PageSwitcherProps {
  siteId: string;
  currentPageId: string;
  currentLabel: string;
}

/**
 * Dropdown nella barra in alto dell'editor per passare da una pagina
 * all'altra senza uscire — la lista viene caricata solo quando si apre
 * (`enabled: open`), non ad ogni render della shell dell'editor. MVP: la
 * prima pagina di `listPages` (20 risultati) — un sito con più pagine di
 * così vede la lista troncata invece di paginare dentro il dropdown, scelta
 * deliberata per tenere lo scope contenuto.
 */
export function PageSwitcher({
  siteId,
  currentPageId,
  currentLabel,
}: PageSwitcherProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    ...pagesQueryOptions(siteId, 1),
    enabled: open,
  });

  function handleSelect(pageId: string): void {
    setOpen(false);
    if (pageId !== currentPageId) {
      void navigate({ to: '/pages/$pageId', params: { pageId } });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
        >
          <span className="max-w-40 truncate">{currentLabel}</span>
          <ChevronDown size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
          {t('canvas.switchPage')}
        </p>
        <div className="max-h-72 overflow-y-auto">
          {data?.items.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => handleSelect(page.id)}
              className={cn(
                'flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
                page.id === currentPageId && 'bg-muted font-medium',
              )}
            >
              {page.slug}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
