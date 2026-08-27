import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  localeSettingsSchema,
  type LocaleSettings,
  type SiteRecord,
} from '@brisk/shared-types';
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
import { useResetFormOnOpen } from './use-reset-form-on-open.js';
import { useSiteLocaleSettings } from './use-site-locale-settings.js';

export interface LocaleSettingsDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toFormValues(site: SiteRecord): LocaleSettings {
  return {
    enabledLocales: site.enabledLocales,
    defaultLocale: site.defaultLocale,
    untranslatedPageFallback: site.untranslatedPageFallback,
  };
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
  const [error, setError] = useState('');

  const { control, handleSubmit, reset, setValue } = useForm<LocaleSettings>({
    resolver: zodResolver(localeSettingsSchema),
    defaultValues: {
      enabledLocales: [],
      defaultLocale: '',
      untranslatedPageFallback: 'redirect-to-default',
    },
  });
  useResetFormOnOpen(open, site, reset, (currentSite) => {
    setError('');
    return toFormValues(currentSite);
  });

  const enabledLocales = useWatch({ control, name: 'enabledLocales' });
  const defaultLocale = useWatch({ control, name: 'defaultLocale' });
  const untranslatedPageFallback = useWatch({
    control,
    name: 'untranslatedPageFallback',
  });

  async function onSubmit(values: LocaleSettings) {
    setError('');
    try {
      await updateLocaleSettings(values);
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
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t('localeSettings.localesLabel')}</Label>
                <LocaleListEditor
                  enabledLocales={enabledLocales}
                  defaultLocale={defaultLocale}
                  onChange={(locales, nextDefault) => {
                    setValue('enabledLocales', locales);
                    setValue('defaultLocale', nextDefault);
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
                <Controller
                  control={control}
                  name="untranslatedPageFallback"
                  render={({ field }) => (
                    <Switch
                      checked={field.value === 'not-available'}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked ? 'not-available' : 'redirect-to-default',
                        )
                      }
                      aria-label={t('localeSettings.fallbackLabel')}
                    />
                  )}
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
                type="submit"
                disabled={isSaving || enabledLocales.length === 0}
              >
                {isSaving
                  ? t('localeSettings.saving')
                  : t('localeSettings.save')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
