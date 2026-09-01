import { z } from 'zod';
import type { Block, PageContent } from './content-model';

/**
 * Il testo tradotto di UNA locale — solo i campi marcati `translatable`
 * (`FieldDescriptor.translatable` in `@brisk/block-registry`) hanno una
 * riga qui; un campo assente eredita il valore condiviso da
 * `PageGroup.content` (fallback alla lingua di default del sito). Chiavato
 * per id blocco poi per chiave campo — nessun riferimento al `kind`/tipo
 * del blocco: `mergeTranslatedContent` sotto non ha (e non deve avere)
 * bisogno di conoscere quali campi sono traducibili, solo di sapere quali
 * override esistono per davvero. Quella decisione (dove va scritta una
 * modifica: qui o su `PageGroup.content`) è responsabilità di chi scrive,
 * non di chi legge — vedi editor-app's InspectorPanel/usePropertyPatch.
 */
export const fieldValueOverlaySchema = z.record(
  z.string(),
  z.record(z.string(), z.string()),
);
export type FieldValueOverlay = z.infer<typeof fieldValueOverlaySchema>;

function mergeBlock(block: Block, fieldValues: FieldValueOverlay): Block {
  const overrides = block.id ? fieldValues[block.id] : undefined;
  const children = block.children?.map((child) =>
    mergeBlock(child, fieldValues),
  );
  return {
    ...block,
    props: overrides ? { ...block.props, ...overrides } : block.props,
    ...(children ? { children } : {}),
  };
}

/**
 * Produce l'albero renderizzabile per UNA lingua: la struttura canonica
 * condivisa (`groupContent`, `PageGroup.content`) con i valori di testo di
 * quella lingua innestati sopra. Un blocco senza `id` (non dovrebbe
 * succedere dopo il backfill iniziale) non riceve mai override — nessun
 * modo affidabile di sapere a quale riga di `fieldValues` corrisponde.
 * Pura e a senso unico: non produce mai `fieldValues` a partire da un
 * `PageContent` — quella direzione (estrarre gli override da un contenuto
 * già scritto) è compito dello script di backfill una tantum, non di
 * questa funzione.
 */
export function mergeTranslatedContent(
  groupContent: PageContent,
  fieldValues: FieldValueOverlay,
): PageContent {
  return groupContent.map((block) => mergeBlock(block, fieldValues));
}
