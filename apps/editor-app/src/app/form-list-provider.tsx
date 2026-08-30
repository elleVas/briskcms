import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { FormListContext, type FormListPort } from '@brisk/block-registry';
import type { PickedForm } from '@brisk/shared-types';
import { FormPickerDialog } from './form-picker-dialog';

export interface FormListProviderProps {
  siteId: string;
  children: ReactNode;
}

/**
 * The concrete implementation of @brisk/block-registry's FormListPort — same
 * Promise-based `pick()` pattern as MediaPickerProvider.
 */
export function FormListProvider({ siteId, children }: FormListProviderProps) {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((value: PickedForm | null) => void) | null>(null);

  const pick = useCallback((): Promise<PickedForm | null> => {
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function resolveAndClose(value: PickedForm | null) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  }

  const port = useMemo<FormListPort>(() => ({ pick }), [pick]);

  return (
    <FormListContext.Provider value={port}>
      {children}
      <FormPickerDialog
        siteId={siteId}
        open={open}
        onOpenChange={(next) => {
          if (!next) resolveAndClose(null);
        }}
        onSelect={(form) =>
          resolveAndClose({ formId: form.id, formName: form.name })
        }
      />
    </FormListContext.Provider>
  );
}
