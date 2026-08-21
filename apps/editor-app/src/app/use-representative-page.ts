import { useQuery } from '@tanstack/react-query';
import { pagesQueryOptions } from './pages-queries.js';

/**
 * L'editor Header/Footer non ha una pagina propria — canvas-editor-shell.tsx
 * mostra sempre il canvas Astro vero di UNA PAGINA (vedi canvas-frame.tsx),
 * anche quando si sta editando header/footer, per riusare la stessa rotta
 * di preview invece di costruirne una seconda dedicata. Questo hook sceglie
 * quella pagina: la prima nella locale della sezione in editing, tra le
 * prime `PAGES_PAGE_SIZE` del sito — non esaustivo su siti con più pagine
 * di quante ne stia una singola pagina di risultati, ma è solo lo sfondo su
 * cui visualizzare l'header/footer in editing, non il contenuto editato.
 */
export function useRepresentativePage(siteId: string, locale: string) {
  const { data, isLoading } = useQuery(pagesQueryOptions(siteId, 1));
  const page = data?.items.find((item) => item.locale === locale) ?? null;
  return { page, isLoading };
}
