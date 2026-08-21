import { createContext, useContext } from 'react';
import type { PickedForm } from '@brisk/shared-types';

/**
 * Stessa inversione di MediaPickerContext: il blocco Form ha bisogno di un
 * modo per far scegliere all'editor un modulo esistente, ma questo package
 * definisce solo descrittori di blocco e non ha un client HTTP o UI a
 * livello applicativo. Il dialog reale (che lista i moduli dall'API vera) è
 * di proprietà di apps/editor-app e fornito tramite questo context.
 */
export interface FormListPort {
  pick(): Promise<PickedForm | null>;
}

export const FormListContext = createContext<FormListPort | null>(null);

export function useFormList(): FormListPort {
  const port = useContext(FormListContext);
  if (!port) {
    throw new Error(
      'useFormList() chiamato fuori da un FormListContext.Provider — avvolgi il canvas con il form list provider (apps/editor-app) prima di renderizzare il blocco Form.',
    );
  }
  return port;
}
