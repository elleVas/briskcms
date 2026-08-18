import { createContext, useContext } from 'react';
import type { PickedMedia } from '@brisk/shared-types';

/**
 * The Image/Gallery blocks need a way to let the user pick an uploaded
 * image, but this package only defines Puck block configs (see
 * docs/adr/0007) — it has no HTTP client, no API base URL, no app-level
 * UI (Dialog, etc.), and shouldn't grow any of that just for this. The
 * actual picker UI (a dialog listing the media library, wired to the real
 * API) is owned by apps/editor-app and supplied through this context, the
 * same inversion already used for auth/tenant context on the backend side.
 */
export interface MediaPickerPort {
  pick(): Promise<PickedMedia | null>;
}

export const MediaPickerContext = createContext<MediaPickerPort | null>(null);

export function useMediaPicker(): MediaPickerPort {
  const picker = useContext(MediaPickerContext);
  if (!picker) {
    throw new Error(
      'useMediaPicker() called outside a MediaPickerContext.Provider — wrap <Puck> with the media picker provider (apps/editor-app) before rendering the Image/Gallery blocks.',
    );
  }
  return picker;
}
