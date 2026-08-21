import { createContext, useContext } from 'react';
import type { PickedPage } from '@brisk/shared-types';

/**
 * Stessa inversione di FormListContext/MediaPickerContext: i blocchi
 * NavLink/Button/Link/Banner/PromoBar/PricingPlan hanno bisogno di un modo
 * per far scegliere all'editor una pagina del sito, ma questo package
 * definisce solo descrittori di blocco e non ha un client HTTP o UI a
 * livello applicativo. Il dialog reale (che lista le pagine dall'API vera,
 * filtrate alla locale della sezione in editing) è di proprietà di
 * apps/editor-app e fornito tramite questo context.
 */
export interface PageListPort {
  pick(): Promise<PickedPage | null>;
}

export const PageListContext = createContext<PageListPort | null>(null);

export function usePageList(): PageListPort {
  const port = useContext(PageListContext);
  if (!port) {
    throw new Error(
      'usePageList() chiamato fuori da un PageListContext.Provider — avvolgi il canvas con il page list provider (apps/editor-app) prima di renderizzare i blocchi con un link a pagina.',
    );
  }
  return port;
}
