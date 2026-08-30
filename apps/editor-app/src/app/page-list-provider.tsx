import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { PageListContext, type PageListPort } from '@brisk/block-registry';
import type { PickedPage } from '@brisk/shared-types';
import { PagePickerDialog } from './page-picker-dialog';

export interface PageListProviderProps {
  siteId: string;
  // Which locale's pages to offer — a NavLink shouldn't be able to point
  // at a page in a different language than the Header/Footer it lives in
  // (docs/adr/0018).
  locale: string;
  children: ReactNode;
}

/**
 * The concrete implementation of @brisk/block-registry's PageListPort — same
 * Promise-based `pick()` pattern as FormListProvider/MediaPickerProvider.
 */
export function PageListProvider({
  siteId,
  locale,
  children,
}: PageListProviderProps) {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((value: PickedPage | null) => void) | null>(null);

  const pick = useCallback((): Promise<PickedPage | null> => {
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function resolveAndClose(value: PickedPage | null) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  }

  const port = useMemo<PageListPort>(() => ({ pick }), [pick]);

  return (
    <PageListContext.Provider value={port}>
      {children}
      <PagePickerDialog
        siteId={siteId}
        locale={locale}
        open={open}
        onOpenChange={(next) => {
          if (!next) resolveAndClose(null);
        }}
        onSelect={(page) =>
          resolveAndClose({
            pageId: page.id,
            locale: page.locale,
            slug: page.slug,
            title: page.seoMeta.title || page.slug,
          })
        }
      />
    </PageListContext.Provider>
  );
}
