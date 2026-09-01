import { useQuery } from '@tanstack/react-query';
import {
  pageGroupsQueryOptions,
  pageGroupTranslationsQueryOptions,
} from './page-groups-queries';

/**
 * L'editor Header/Footer non ha una pagina propria — canvas-editor-shell.tsx
 * mostra sempre il canvas Astro vero di UNA PageTranslation (vedi
 * canvas-frame.tsx), anche quando si sta editando header/footer, per riusare
 * la stessa rotta di preview invece di costruirne una seconda dedicata.
 * Questo hook sceglie quella traduzione: la prima nella locale della sezione
 * in editing, tra i primi `PAGE_GROUPS_PAGE_SIZE` gruppi del sito — non
 * esaustivo su siti con più pagine di quante ne stia una singola pagina di
 * risultati, ma è solo lo sfondo su cui visualizzare l'header/footer in
 * editing, non il contenuto editato. Il filtro `locale` lato server
 * garantisce che il primo gruppo restituito abbia già una traduzione in
 * questa lingua, quindi il secondo fetch (traduzioni del gruppo) non ha
 * bisogno di un proprio fallback vuoto.
 */
export function useRepresentativePage(siteId: string, locale: string) {
  const { data: groups, isLoading: isLoadingGroups } = useQuery(
    pageGroupsQueryOptions(siteId, 1, { locale }),
  );
  const groupId = groups?.items[0]?.id ?? null;
  const { data: translations, isLoading: isLoadingTranslations } = useQuery({
    ...pageGroupTranslationsQueryOptions(groupId ?? ''),
    enabled: Boolean(groupId),
  });
  const translation =
    translations?.find((item) => item.locale === locale) ?? null;
  return {
    page: translation ? { id: translation.id } : null,
    isLoading: isLoadingGroups || (Boolean(groupId) && isLoadingTranslations),
  };
}
