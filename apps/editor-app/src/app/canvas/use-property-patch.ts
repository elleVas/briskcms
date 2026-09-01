import { useCallback, useEffect, useRef } from 'react';
import type { Block, BlockStyleOverride } from '@brisk/shared-types';
import { renderBlockFragment } from '../../lib/block-fragment-api-client';

export interface UsePropertyPatchInput {
  pageId: string;
  token: string;
  /**
   * Chiamato con le props già fuse (il chiamante possiede l'albero, vedi
   * use-block-tree.ts) — persiste la bozza reale. `changedKey` è la SINGOLA
   * chiave che questa chiamata sta effettivamente cambiando (`props` resta
   * l'intero oggetto fuso, serve comunque per il render server-side del
   * frammento) — permette al chiamante (canvas-editor-shell.tsx, i18n a
   * livello di campo) di instradare SOLO quella chiave verso l'overlay di
   * una traduzione quando serve, senza dover ridurre `props` da solo.
   */
  onSaveDraft: (
    blockId: string,
    changedKey: string,
    props: Record<string, unknown>,
  ) => void;
  /** Come `onSaveDraft` ma per l'override per-istanza (docs/adr/0022) — un valore separato da `props`, sostituito per intero (vedi use-block-tree.ts's updateBlockStyleOverride), non fuso campo-per-campo. */
  onSaveStyleOverride: (
    blockId: string,
    styleOverride: BlockStyleOverride,
  ) => void;
  /** Da usePreviewBridge — invia editor:patch-block all'iframe. */
  patchBlock: (blockId: string, html: string) => void;
  debounceMs?: number;
}

export interface UsePropertyPatchResult {
  /** Da chiamare ad ogni cambio proprietà dall'Inspector — un blockId alla volta ha il proprio timer indipendente, cambiare un blocco non azzera il debounce di un altro. */
  scheduleChange: (
    blockId: string,
    blockType: string,
    changedKey: string,
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
  /** Da chiamare ad ogni cambio nel popover di stile per-istanza (docs/adr/0022) — timer indipendente da `scheduleChange`: un cambio di stile e un cambio di proprietà "normale" sullo stesso blocco, ravvicinati, non si annullano il debounce a vicenda. */
  scheduleStyleOverrideChange: (
    blockId: string,
    blockType: string,
    props: Record<string, unknown>,
    styleOverride: BlockStyleOverride,
    children?: Block[],
  ) => void;
  /**
   * Fires every still-pending debounced save right now, instead of waiting
   * out its timer — called before Publish (canvas-editor-shell.tsx's own
   * handlePublish) so the last keystroke within the debounce window is
   * never silently dropped from what gets published. Safe to call with
   * nothing pending (no-op).
   */
  flushAll: () => void;
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
  onSaveStyleOverride,
  patchBlock,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UsePropertyPatchInput): UsePropertyPatchResult {
  const timers = useRef(
    new Map<
      string,
      { timeout: ReturnType<typeof setTimeout>; fire: () => void }
    >(),
  );

  useEffect(() => {
    const timersAtMount = timers.current;
    return () => {
      for (const { timeout } of timersAtMount.values()) {
        clearTimeout(timeout);
      }
      timersAtMount.clear();
    };
  }, []);

  // Chiave di debounce distinta da un plain blockId (vedi scheduleTextChange
  // sotto) — un cambio di proprietà non testuale e un testo in editing sullo
  // stesso blocco hanno timer indipendenti, l'uno non azzera il debounce
  // dell'altro. `fire` è tenuto insieme al timeout (non solo quest'ultimo)
  // così flushAll sotto può invocarlo subito, invece di aspettare che scada.
  function schedule(timerKey: string, fire: () => void): void {
    const existing = timers.current.get(timerKey);
    if (existing) {
      clearTimeout(existing.timeout);
    }
    const timeout = setTimeout(() => {
      timers.current.delete(timerKey);
      fire();
    }, debounceMs);
    timers.current.set(timerKey, { timeout, fire });
  }

  const flushAll = useCallback(() => {
    const pending = [...timers.current.values()];
    timers.current.clear();
    for (const { timeout, fire } of pending) {
      clearTimeout(timeout);
      fire();
    }
  }, []);

  const scheduleChange = useCallback(
    (
      blockId: string,
      blockType: string,
      changedKey: string,
      props: Record<string, unknown>,
      children?: Block[],
    ) => {
      schedule(blockId, () => {
        onSaveDraft(blockId, changedKey, props);
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
        onSaveDraft(blockId, field, { [field]: text });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vedi scheduleChange sopra.
    [onSaveDraft, debounceMs],
  );

  const scheduleStyleOverrideChange = useCallback(
    (
      blockId: string,
      blockType: string,
      props: Record<string, unknown>,
      styleOverride: BlockStyleOverride,
      children?: Block[],
    ) => {
      schedule(`style:${blockId}`, () => {
        onSaveStyleOverride(blockId, styleOverride);
        renderBlockFragment({
          pageId,
          token,
          blockId,
          blockType,
          props,
          children,
          styleOverride,
        })
          .then((html) => patchBlock(blockId, html))
          .catch(() => {
            /* la bozza è già salvata sopra — vedi lo stesso commento di scheduleChange. */
          });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vedi scheduleChange sopra.
    [pageId, token, onSaveStyleOverride, patchBlock, debounceMs],
  );

  return {
    scheduleChange,
    scheduleTextChange,
    scheduleStyleOverrideChange,
    flushAll,
  };
}
