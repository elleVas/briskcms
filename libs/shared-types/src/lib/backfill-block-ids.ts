import type { Block } from './content-model';

// Web Crypto (`globalThis.crypto`), non `node:crypto` — questo file è
// esportato dal barrel di @brisk/shared-types, che apps/public-site importa
// anche da script client-side (preview-bridge-client.ts): un import di
// `node:crypto` verrebbe esternalizzato da Vite per il bundle browser e
// lancerebbe non appena il barrel viene valutato, anche se questa funzione
// specifica non viene mai chiamata lì. `crypto.randomUUID()` è lo stesso
// Web Crypto API standard sia in Node (globale dalla v19) che nel browser.
const randomUUID = (): string => crypto.randomUUID();

/**
 * Assegna un id stabile ad ogni blocco che ne è privo, ricorsivamente su
 * `children` — mai a un blocco che ne ha già uno (idempotente: un secondo
 * giro su contenuto già backfillato non cambia nulla). Non muta l'array/gli
 * oggetti in input: costruisce alberi nuovi solo per i rami effettivamente
 * toccati, così un chiamante può confrontare `changed` per decidere se vale
 * la pena scrivere la riga.
 *
 * Perché non la rigenerazione pigra ad ogni load: un id che cambia finché
 * nessuno salva è fragile proprio per drag/selezione/patch a frammento, che
 * lo useranno come identità stabile — vedi il piano dell'editor, Giorno 1.
 */
export function backfillBlockIds(blocks: Block[]): {
  content: Block[];
  changed: boolean;
} {
  let changed = false;

  const content = blocks.map((block) => {
    const needsId = !block.id;
    const childResult = block.children
      ? backfillBlockIds(block.children)
      : null;

    if (!needsId && !childResult?.changed) {
      return block;
    }

    changed = true;
    return {
      ...block,
      id: block.id ?? randomUUID(),
      ...(childResult ? { children: childResult.content } : {}),
    };
  });

  return { content, changed };
}
