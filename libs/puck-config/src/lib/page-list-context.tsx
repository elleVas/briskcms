import { createContext, useContext } from 'react';
import type { PickedPage } from '@brisk/shared-types';

/**
 * Same inversion as FormListContext/MediaPickerContext: the NavLink block
 * needs a way to let the user pick one of the site's own pages, but this
 * package only defines Puck block configs (docs/adr/0007) and has no HTTP
 * client or app-level UI. The actual picker dialog (listing pages from the
 * real API, filtered to the section being edited's own locale) is owned by
 * apps/editor-app and supplied through this context.
 */
export interface PageListPort {
  pick(): Promise<PickedPage | null>;
}

export const PageListContext = createContext<PageListPort | null>(null);

export function usePageList(): PageListPort {
  const port = useContext(PageListContext);
  if (!port) {
    throw new Error(
      'usePageList() called outside a PageListContext.Provider — wrap <Puck> with the page list provider (apps/editor-app) before rendering the NavLink block.',
    );
  }
  return port;
}
