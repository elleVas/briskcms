import { createContext, useContext } from 'react';
import type { PickedMedia } from '@brisk/shared-types';

/**
 * The Image/Gallery/BeforeAfter/etc. blocks need a way to let the
 * editor pick an uploaded image, but this package only defines block
 * descriptors (docs/adr/0007) — it has no HTTP client, doesn't know the
 * API base URL, has no application-level UI (Dialog, etc.), and
 * shouldn't grow any of that just for this. The real picker UI (a
 * dialog that lists the media library, wired to the real API) is owned
 * by apps/editor-app and provided through this context — the same
 * inversion already used for auth/tenant context on the backend.
 */
export interface MediaPickerPort {
  pick(): Promise<PickedMedia | null>;
}

export const MediaPickerContext = createContext<MediaPickerPort | null>(null);

export function useMediaPicker(): MediaPickerPort {
  const picker = useContext(MediaPickerContext);
  if (!picker) {
    throw new Error(
      'useMediaPicker() called outside a MediaPickerContext.Provider — wrap the canvas with the media picker provider (apps/editor-app) before rendering Image/Gallery blocks.',
    );
  }
  return picker;
}
