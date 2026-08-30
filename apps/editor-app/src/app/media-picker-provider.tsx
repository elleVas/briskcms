import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  MediaPickerContext,
  type MediaPickerPort,
} from '@brisk/block-registry';
import type { PickedMedia } from '@brisk/shared-types';
import { MediaPickerDialog } from './media-picker-dialog';

export interface MediaPickerProviderProps {
  siteId: string;
  children: ReactNode;
}

/**
 * The concrete implementation of @brisk/block-registry's MediaPickerPort
 * (see media-picker-context.tsx there for why the block config itself
 * can't own this): a Promise-based `pick()` that opens this dialog and
 * resolves once the user selects an image or dismisses it.
 */
export function MediaPickerProvider({
  siteId,
  children,
}: MediaPickerProviderProps) {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((value: PickedMedia | null) => void) | null>(null);

  const pick = useCallback((): Promise<PickedMedia | null> => {
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function resolveAndClose(value: PickedMedia | null) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  }

  const port = useMemo<MediaPickerPort>(() => ({ pick }), [pick]);

  return (
    <MediaPickerContext.Provider value={port}>
      {children}
      <MediaPickerDialog
        siteId={siteId}
        open={open}
        onOpenChange={(next) => {
          if (!next) resolveAndClose(null);
        }}
        onSelect={(media) =>
          resolveAndClose({
            mediaId: media.id,
            url: media.url,
            width: media.width,
            height: media.height,
          })
        }
      />
    </MediaPickerContext.Provider>
  );
}
