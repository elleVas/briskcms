import {
  useEffect,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { findBlockInTree, updateBlockProps } from './use-block-tree.js';
import type { PreviewBridgeState } from './use-preview-bridge.js';

/** Il field è testuale e marcato `inlineEditable` sul descrittore — l'unico caso in cui un doppio click deve montare TipTap. */
function isInlineEditableField(
  descriptor: BlockDescriptor | undefined,
  field: string,
): boolean {
  const fieldDescriptor = descriptor?.fields.find((f) => f.key === field);
  return (
    (fieldDescriptor?.kind === 'text' ||
      fieldDescriptor?.kind === 'textarea') &&
    Boolean(fieldDescriptor.inlineEditable)
  );
}

export interface UseTextEditParams {
  bridge: Pick<
    PreviewBridgeState,
    'lastTextChange' | 'lastDblClick' | 'enterTextEdit' | 'exitTextEdit'
  >;
  registry: BlockDescriptor[];
  localBlocksRef: RefObject<Block[]>;
  setLocalBlocks: Dispatch<SetStateAction<Block[]>>;
  scheduleTextChange: (blockId: string, field: string, text: string) => void;
}

/**
 * Editing testo live via TipTap montato sul posto nell'iframe (Giorno 4) —
 * aggiornamento OTTICO dell'albero (stato derivato da `bridge.lastTextChange`,
 * "aggiusta lo stato durante il render") + i due trigger (doppio click per
 * entrare, Escape per uscire) + il side-effect vero (pianifica il
 * salvataggio debounced). Isolato da canvas-editor-shell.tsx per essere
 * testabile senza montare l'intera shell — stesso schema di
 * use-preview-bridge.ts/use-property-patch.ts.
 */
export function useTextEdit({
  bridge,
  registry,
  localBlocksRef,
  setLocalBlocks,
  scheduleTextChange,
}: UseTextEditParams): void {
  // Stesso pattern "aggiusta lo stato durante il render" di altri punti
  // della shell: `bridge.lastTextChange` è già stato reso stato React da
  // usePreviewBridge (il vero confine esterno — il listener `message` —
  // vive lì, dentro il suo handler), quindi applicarlo qui è "stato
  // derivato da una prop cambiata", non "sincronizzare con un sistema
  // esterno" — la forma che la regola `react-hooks/set-state-in-effect`
  // chiede di evitare in un effect. Solo l'aggiornamento OTTICO dell'albero
  // vive qui — pianificare il salvataggio (scheduleTextChange, un vero
  // side-effect: avvia un timer) resta in un effect a parte sotto.
  const [lastAppliedTextChange, setLastAppliedTextChange] = useState(
    bridge.lastTextChange,
  );
  if (bridge.lastTextChange !== lastAppliedTextChange) {
    setLastAppliedTextChange(bridge.lastTextChange);
    if (bridge.lastTextChange) {
      const { blockId, field, text } = bridge.lastTextChange;
      setLocalBlocks((prev) =>
        updateBlockProps(prev, blockId, { [field]: text }),
      );
    }
  }

  // Pianifica il salvataggio debounced del testo digitato dal vivo — nessun
  // setState qui (l'aggiornamento ottico vive nel blocco sopra), solo il
  // vero side-effect (scheduleTextChange avvia un timer), quindi un effect
  // è la sede corretta per questa parte.
  useEffect(() => {
    if (!bridge.lastTextChange) {
      return;
    }
    const { blockId, field, text } = bridge.lastTextChange;
    scheduleTextChange(blockId, field, text);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo a un NUOVO lastTextChange — scheduleTextChange è letta dal valore corrente, non serve rieseguire per un suo cambio di riferimento.
  }, [bridge.lastTextChange]);

  // Trigger per l'editing testo inline — reagisce ad ogni nuovo doppio
  // click riportato dal bridge (un oggetto nuovo per riferimento ad ogni
  // messaggio, vedi use-preview-bridge.ts), verifica che il field sia
  // davvero `inlineEditable` sul descrittore prima di montare TipTap.
  useEffect(() => {
    if (!bridge.lastDblClick?.field) {
      return;
    }
    const { blockId, field } = bridge.lastDblClick;
    const block = findBlockInTree(localBlocksRef.current, blockId);
    const descriptor = block
      ? registry.find((d) => d.type === block.type)
      : undefined;
    if (isInlineEditableField(descriptor, field)) {
      bridge.enterTextEdit(blockId, field);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo a un NUOVO lastDblClick — bridge.enterTextEdit/registry sono letti dal valore corrente, non serve rieseguire per un loro cambio di riferimento.
  }, [bridge.lastDblClick]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        bridge.exitTextEdit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bridge.exitTextEdit ha identità stabile (vedi usePreviewBridge), non serve nelle dipendenze.
  }, []);
}
