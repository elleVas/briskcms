import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { UntranslatedPageFallback } from '@brisk/shared-types';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';
import { Label } from '../components/ui/label.js';
import { Switch } from '../components/ui/switch.js';
import { LocaleListEditor } from './locale-list-editor.js';
import { siteQueryOptions } from './site-queries.js';
import { useSiteLocaleSettings } from './use-site-locale-settings.js';

export interface LocaleSettingsDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocaleSettingsDialog({
  siteId,
  open,
  onOpenChange,
}: LocaleSettingsDialogProps) {
  const { t } = useTranslation();
  // Gated on `open`: same reasoning as GeneralSettingsDialog — this dialog
  // can be mounted for the app's whole lifetime (rendered from SettingsMenu).
  const { data: site } = useQuery({
    ...siteQueryOptions(siteId),
    enabled: open,
  });
  const { updateLocaleSettings, isSaving } = useSiteLocaleSettings(siteId);

  const [enabledLocales, setEnabledLocales] = useState<string[]>([]);
  const [defaultLocale, setDefaultLocale] = useState('');
  const [untranslatedPageFallback, setUntranslatedPageFallback] =
    useState<UntranslatedPageFallback>('redirect-to-default');
  const [error, setError] = useState('');

  // Same "adjust state during render" resync as GeneralSettingsDialog.
  const [lastSyncKey, setLastSyncKey] = useState<string | null>(null);
  const syncKey = open ? `open:${site?.id ?? 'loading'}` : 'closed';
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    if (open && site) {
      setEnabledLocales(site.enabledLocales);
      setDefaultLocale(site.defaultLocale);
      setUntranslatedPageFallback(site.untranslatedPageFallback);
      setError('');
    }
  }

  async function handleSubmit() {
    setError('');
    try {
      await updateLocaleSettings({
        enabledLocales,
        defaultLocale,
        untranslatedPageFallback,
      });
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('localeSettings.title')}</DialogTitle>
        </DialogHeader>
        {!site ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t('localeSettings.localesLabel')}</Label>
                <LocaleListEditor
                  enabledLocales={enabledLocales}
                  defaultLocale={defaultLocale}
                  onChange={(locales, nextDefault) => {
                    setEnabledLocales(locales);
                    setDefaultLocale(nextDefault);
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {t('localeSettings.fallbackLabel')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {untranslatedPageFallback === 'not-available'
                      ? t('localeSettings.fallbackNotAvailableDescription')
                      : t('localeSettings.fallbackRedirectDescription')}
                  </span>
                </div>
                <Switch
                  checked={untranslatedPageFallback === 'not-available'}
                  onCheckedChange={(checked) =>
                    setUntranslatedPageFallback(
                      checked ? 'not-available' : 'redirect-to-default',
                    )
                  }
                  aria-label={t('localeSettings.fallbackLabel')}
                />
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('localeSettings.cancel')}
              </Button>
              <Button
                type="button"
                disabled={isSaving || enabledLocales.length === 0}
                onClick={() => void handleSubmit()}
              >
                {isSaving
                  ? t('localeSettings.saving')
                  : t('localeSettings.save')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
