import { createContext, useContext } from 'react';

/**
 * Stessa inversione di PageListContext/MediaPickerContext: i blocchi che
 * offrono un campo icona (docs/adr/0023) hanno bisogno di un modo per far
 * scegliere all'editor un'icona del tema attivo, ma questo package
 * definisce solo descrittori di blocco e non ha un client HTTP o UI a
 * livello applicativo. Il dialog reale (che chiama
 * `GET /api/themes/current/icons` su apps/public-site) è di proprietà di
 * apps/editor-app e fornito tramite questo context.
 *
 * A differenza di PageListPort/MediaPickerPort, il valore salvato sul
 * blocco è un semplice nome stringa (non un oggetto denormalizzato con già
 * dentro l'anteprima) — `resolve()` dà al field il markup SVG per
 * mostrare l'icona già scelta senza dover riaprire il dialog.
 */
export interface IconListPort {
  pick(): Promise<string | null>;
  resolve(name: string): string | null;
}

export const IconListContext = createContext<IconListPort | null>(null);

export function useIconList(): IconListPort {
  const port = useContext(IconListContext);
  if (!port) {
    throw new Error(
      "useIconList() chiamato fuori da un IconListContext.Provider — avvolgi il canvas con l'icon list provider (apps/editor-app) prima di renderizzare blocchi con un campo icona.",
    );
  }
  return port;
}
