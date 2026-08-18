import { useTranslation } from 'react-i18next';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button } from '../components/ui/button.js';

export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();

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
