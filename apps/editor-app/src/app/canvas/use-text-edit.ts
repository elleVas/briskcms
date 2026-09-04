import {
  useEffect,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { findBlockInTree, updateBlockProps } from './use-block-tree';
import type { PreviewBridgeState } from './use-preview-bridge';

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
 * Live text editing through TipTap mounted in place in the iframe (Day 4) —
 * the OPTIMISTIC update of the tree (state derived from
 * `bridge.lastTextChange`, "adjust state during render") plus the two
 * triggers (double click to enter, Escape to leave) plus the real side
 * effect (scheduling the debounced save). Isolated from
 * canvas-editor-shell.tsx so it can be tested without mounting the whole
 * shell — the same pattern as use-preview-bridge.ts/use-property-patch.ts.
 */
export function useTextEdit({
  bridge,
  registry,
  localBlocksRef,
  setLocalBlocks,
  scheduleTextChange,
}: UseTextEditParams): void {
  // The same "adjust state during render" pattern as elsewhere in the
  // shell: `bridge.lastTextChange` has already been turned into React state
  // by usePreviewBridge (the real external boundary — the `message`
  // listener — lives there, inside its handler), so applying it here is
  // "state derived from a changed prop", not "synchronizing with an
  // external system" — the shape the `react-hooks/set-state-in-effect` rule
  // asks you to avoid in an effect. Only the OPTIMISTIC tree update lives
  // here — scheduling the save (scheduleTextChange, a real side effect: it
  // starts a timer) stays in a separate effect below.
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

  // Schedules the debounced save of the text typed live — no setState here
  // (the optimistic update lives in the block above), only the real side
  // effect (scheduleTextChange starts a timer), so an effect is the right
  // home for this part.
  useEffect(() => {
    if (!bridge.lastTextChange) {
      return;
    }
    const { blockId, field, text } = bridge.lastTextChange;
    scheduleTextChange(blockId, field, text);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts only to a NEW lastTextChange; scheduleTextChange is read from its current value, so there is no need to re-run when its identity changes.
  }, [bridge.lastTextChange]);

  // The trigger for inline text editing — it reacts to every new double
  // click reported by the bridge (a new object by reference on each
  // message, see use-preview-bridge.ts), and checks the field really is
  // `inlineEditable` on the descriptor before mounting TipTap.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts only to a NEW lastDblClick; bridge.enterTextEdit/registry are read from their current values, so there is no need to re-run when their identity changes.
  }, [bridge.lastDblClick]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        bridge.exitTextEdit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bridge.exitTextEdit has a stable identity (see usePreviewBridge), so it does not belong in the dependencies.
  }, []);
}
