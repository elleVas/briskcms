import { useCallback, useEffect, useRef } from 'react';
import type { Block } from '@brisk/shared-types';
import { renderBlockFragment } from '../../lib/block-fragment-api-client.js';

export interface UsePropertyPatchInput {
  pageId: string;
  token: string;
  /** Chiamato con le props già fuse (il chiamante possiede l'albero, vedi use-block-tree.ts) — persiste la bozza reale. */
  onSaveDraft: (blockId: string, props: Record<string, unknown>) => void;
  /** Da usePreviewBridge — invia editor:patch-block all'iframe. */
  patchBlock: (blockId: string, html: string) => void;
  debounceMs?: number;
}

export interface UsePropertyPatchResult {
  /** Da chiamare ad ogni cambio proprietà dall'Inspector — un blockId alla volta ha il proprio timer indipendente, cambiare un blocco non azzera il debounce di un altro. */
  scheduleChange: (
    blockId: string,
    blockType: string,
    props: Record<string, unknown>,
    children?: Block[],
  ) => void;
  /**
   * Da chiamare ad ogni `preview:text-changed` (Giorno 4) — stesso debounce
   * per-blockId di `scheduleChange`, ma solo salvataggio: mai
   * render-block-fragment/patchBlock per il testo, il DOM dentro l'iframe
   * mostra già quello che TipTap ha digitato dal vivo, sostituirlo col
   * frammento appena renderizzato interromperebbe l'istanza TipTap montata
   * lì sopra a metà digitazione.
   */
  scheduleTextChange: (blockId: string, field: string, text: string) => void;
}

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Al cambio di una proprietà: salva la bozza (debounce, stesso
 * `PATCH /pages/:id/draft` di use-page-editor.ts) e in parallelo chiama
 * render-block-fragment coi nuovi props, poi invia `editor:patch-block` —
 * il canvas si aggiorna senza reload dell'iframe. Vedi il piano dell'editor
 * visuale, Giorno 3. Un fallimento di renderBlockFragment non blocca il
 * salvataggio (già avvenuto): il canvas resta con l'ultimo HTML buono
 * finché il prossimo cambio non ritenta.
 */
export function usePropertyPatch({
  pageId,
  token,
  onSaveDraft,
  patchBlock,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UsePropertyPatchInput): UsePropertyPatchResult {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timersAtMount = timers.current;
    return () => {
      for (const timer of timersAtMount.values()) {
        clearTimeout(timer);
      }
      timersAtMount.clear();
    };
  }, []);

  // Chiave di debounce distinta da un plain blockId (vedi scheduleTextChange
  // sotto) — un cambio di proprietà non testuale e un testo in editing sullo
  // stesso blocco hanno timer indipendenti, l'uno non azzera il debounce
  // dell'altro.
  function schedule(timerKey: string, fire: () => void): void {
    const existing = timers.current.get(timerKey);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      timers.current.delete(timerKey);
      fire();
    }, debounceMs);
    timers.current.set(timerKey, timer);
  }

  const scheduleChange = useCallback(
    (
      blockId: string,
      blockType: string,
      props: Record<string, unknown>,
      children?: Block[],
    ) => {
      schedule(blockId, () => {
        onSaveDraft(blockId, props);
        renderBlockFragment({
          pageId,
          token,
          blockId,
          blockType,
          props,
          children,
        })
          .then((html) => patchBlock(blockId, html))
          .catch(() => {
            /* la bozza è già salvata sopra — un fallimento qui lascia solo il canvas visivamente indietro di un cambio, non perde dati. */
          });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `schedule` è ridefinita ad ogni render ma legge solo `timers` (un ref, stabile) e `debounceMs` (già una dipendenza esplicita) — includerla romperebbe l'identità stabile di scheduleChange senza alcun beneficio.
    [pageId, token, onSaveDraft, patchBlock, debounceMs],
  );

  const scheduleTextChange = useCallback(
    (blockId: string, field: string, text: string) => {
      schedule(`text:${blockId}`, () => {
        onSaveDraft(blockId, { [field]: text });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vedi scheduleChange sopra.
    [onSaveDraft, debounceMs],
  );

  return { scheduleChange, scheduleTextChange };
}
