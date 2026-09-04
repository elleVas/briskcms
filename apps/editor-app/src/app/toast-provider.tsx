import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

export type ToastVariant = 'default' | 'destructive' | 'success';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  /** Adds a toast, which auto-dismisses after a few seconds (and can also be closed by hand). It neither blocks nor asks for confirmation — for errors that MUST stop the user, a dialog remains the right choice. */
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 6000;

/**
 * Born from point 12 of the security review: saves that failed silently
 * (`.catch(() => {})` on global and block-type styles) left the user
 * believing everything had gone through. An in-house component rather than
 * a library (an explicit decision) — a simple use case (show a message,
 * auto-dismiss, close by hand) does not justify a new dependency.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'default') => {
      const id = `toast-${nextId.current++}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        // role="status"/aria-live="polite": announced to a screen reader
        // without stealing focus, consistent with the same WCAG 4.1.3 gap
        // reported for Form.astro on the public-site side.
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed right-4 bottom-4 z-200 flex w-full max-w-sm flex-col gap-2"
        >
          {toasts.map((item) => (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border bg-background px-4 py-3 text-sm shadow-lg',
                item.variant === 'destructive' &&
                  'border-destructive/50 bg-destructive/10 text-destructive',
                item.variant === 'success' &&
                  'border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
              )}
            >
              <span className="flex-1">{item.message}</span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label={t('toast.dismiss')}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
