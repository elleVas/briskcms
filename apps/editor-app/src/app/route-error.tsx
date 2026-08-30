import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button } from '../components/ui/button';

export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();

  // Security review 2026-08-24: this boundary showed the error to the user
  // but never logged it anywhere — an error inside a route component
  // disappeared with no trace the moment the tab closed. console.error for
  // now (no Sentry/error-tracking service configured), same reasoning as
  // global-error-handlers.ts.
  useEffect(() => {
    console.error('[route error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-sm">
      <p role="alert" className="text-destructive">
        {t('common.error')}
      </p>
      <p className="text-muted-foreground">{String(error)}</p>
      <Button variant="outline" size="sm" onClick={reset}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
