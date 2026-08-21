import { createContext, useContext } from 'react';
import type { PickedMedia } from '@brisk/shared-types';

/**
 * I blocchi Image/Gallery/BeforeAfter/ecc. hanno bisogno di un modo per far
 * scegliere all'editor un'immagine caricata, ma questo package definisce
 * solo descrittori di blocco (docs/adr/0007) — non ha un client HTTP, non
 * conosce l'URL base dell'API, non ha UI a livello applicativo (Dialog,
 * ecc.), e non dovrebbe crescere nulla di tutto ciò solo per questo. La UI
 * reale del picker (un dialog che lista la libreria media, collegato
 * all'API vera) è di proprietà di apps/editor-app e fornita tramite questo
 * context — stessa inversione già usata per auth/tenant context lato backend.
 */
export interface MediaPickerPort {
  pick(): Promise<PickedMedia | null>;
}

export const MediaPickerContext = createContext<MediaPickerPort | null>(null);

export function useMediaPicker(): MediaPickerPort {
  const picker = useContext(MediaPickerContext);
  if (!picker) {
    throw new Error(
      'useMediaPicker() chiamato fuori da un MediaPickerContext.Provider — avvolgi il canvas con il media picker provider (apps/editor-app) prima di renderizzare i blocchi Image/Gallery.',
    );
  }
  return picker;
}
