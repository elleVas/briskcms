import { useCallback, useRef, useState } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Block } from '@brisk/shared-types';
import { publishPage, saveDraft } from '../lib/pages-api-client';
import { pageQueryOptions } from './pages-queries';

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'published' }
  | { kind: 'error'; message: string };

// Reads through the same query the route loader already warmed (see
// routes/pages.$pageId.tsx) — no extra request, but this hook is now also
// reactively subscribed: a mutation elsewhere that invalidates this page
// (e.g. a rollback) re-renders it with fresh data automatically.
//
// No debounce here (unlike the old Puck-backed version) — canvas-editor-
// shell.tsx already debounces property/text changes on its own (see
// use-property-patch.ts's ~300ms window); insert/remove/reorder call
// `onChange` directly because those should feel instant, not delayed by a
// second debounce layered on top.
export function usePageEditor(pageId: string) {
  const { data: page } = useSuspenseQuery(pageQueryOptions(pageId));
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  const saveDraftMutation = useMutation({
    mutationFn: (content: Block[]) => saveDraft(pageId, content),
    onSuccess: (updated) => {
      queryClient.setQueryData(pageQueryOptions(pageId).queryKey, updated);
      setStatus({ kind: 'saved' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const publishMutation = useMutation({
    mutationFn: async (content: Block[]) => {
      await saveDraft(pageId, content);
      return publishPage(pageId);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(pageQueryOptions(pageId).queryKey, updated);
      // Partial key: invalidates every cached page of list results for
      // this site (see pages-queries.ts), not just one page number.
      queryClient.invalidateQueries({ queryKey: ['pages', updated.siteId] });
      setStatus({ kind: 'published' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  // Coda single-flight: mai più di un PATCH /draft in volo alla volta.
  // Senza questa coda, due `handleChange` ravvicinati (es. un salvataggio
  // debounced di una proprietà e un inserimento immediato) partono come due
  // richieste HTTP indipendenti — e se quella PIÙ VECCHIA completa DOPO
  // quella più nuova (normale jitter di rete, non serve un errore), il
  // server sovrascrive silenziosamente lo stato corretto con uno superato:
  // "vince l'ultima risposta arrivata", non "l'ultima modifica fatta".
  // Riprodotto dal vivo: Hero+Image in editor, solo Hero dopo il reload.
  // Qui invece ogni chiamata aggiorna solo l'ULTIMO stato noto da inviare;
  // se un salvataggio è già in corso, quello nuovo aspetta che finisca —
  // le richieste partono sempre in ordine stretto, mai in parallelo, quindi
  // non possono più completarsi fuori ordine.
  const isSavingRef = useRef(false);
  const pendingContentRef = useRef<Block[] | null>(null);

  const flushPendingSave = useCallback(async () => {
    if (isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;
    try {
      // Loop invece di richiamarsi ricorsivamente: se un nuovo `handleChange`
      // arriva MENTRE questo `await` è in corso, lo riprende subito dopo
      // nello stesso giro, invece di uscire e rientrare nella funzione (il
      // React Compiler non riesce a preservare la memoizzazione di uno
      // `useCallback` che richiama se stesso).
      while (pendingContentRef.current !== null) {
        const next = pendingContentRef.current;
        pendingContentRef.current = null;
        try {
          await saveDraftMutation.mutateAsync(next);
        } catch {
          // Lo stato di errore è già impostato da `onError` sopra — qui
          // basta non bloccare la coda: un cambio successivo deve poter
          // ritentare.
        }
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [saveDraftMutation]);

  const handleChange = useCallback(
    (content: Block[]) => {
      pendingContentRef.current = content;
      void flushPendingSave();
    },
    [flushPendingSave],
  );

  const handlePublish = useCallback(
    (content: Block[]) => publishMutation.mutateAsync(content),
    [publishMutation],
  );

  return { page, status, handleChange, handlePublish };
}
