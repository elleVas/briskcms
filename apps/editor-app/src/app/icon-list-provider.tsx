import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconListContext, type IconListPort } from '@brisk/block-registry';
import { themeIconsQueryOptions } from './theme-icons-queries';
import { useActiveThemeName } from './use-active-theme-name';
import { IconPickerDialog } from './icon-picker-dialog';

export interface IconListProviderProps {
  children: ReactNode;
}

/**
 * The concrete implementation of @brisk/block-registry's IconListPort —
 * same Promise-based `pick()` pattern as PageListProvider/
 * MediaPickerProvider, plus a synchronous `resolve()` backed by the same
 * cached query (staleTime: Infinity, see theme-icons-queries.ts) so
 * IconPickerField can preview an already-picked icon without a second
 * round trip.
 */
export function IconListProvider({ children }: IconListProviderProps) {
  const { data } = useQuery(themeIconsQueryOptions(useActiveThemeName()));
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const pick = useCallback((): Promise<string | null> => {
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const resolve = useCallback(
    (name: string): string | null =>
      data?.find((icon) => icon.name === name)?.svg ?? null,
    [data],
  );

  function resolveAndClose(value: string | null) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  }

  const port = useMemo<IconListPort>(
    () => ({ pick, resolve }),
    [pick, resolve],
  );

  return (
    <IconListContext.Provider value={port}>
      {children}
      <IconPickerDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) resolveAndClose(null);
        }}
        onSelect={(icon) => resolveAndClose(icon.name)}
      />
    </IconListContext.Provider>
  );
}
