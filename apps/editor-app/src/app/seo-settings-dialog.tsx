import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { SiteRecord } from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { siteQueryOptions } from './site-queries';
import { useResetFormOnOpen } from './use-reset-form-on-open';
import { useSiteSeoSettings } from './use-site-seo-settings';

export interface SeoSettingsDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SeoSettingsFormValues {
  searchEngineIndexingEnabled: boolean;
}

function toFormValues(site: SiteRecord): SeoSettingsFormValues {
  return { searchEngineIndexingEnabled: site.searchEngineIndexingEnabled };
}

export function SeoSettingsDialog({
  siteId,
  open,
  onOpenChange,
}: SeoSettingsDialogProps) {
  const { t } = useTranslation();
  const { data: site } = useQuery({
    ...siteQueryOptions(siteId),
    enabled: open,
  });
  const { updateSeoSettings, isSaving } = useSiteSeoSettings(siteId);
  const [error, setError] = useState('');

  const { control, handleSubmit, reset } = useForm<SeoSettingsFormValues>({
    defaultValues: { searchEngineIndexingEnabled: false },
  });
  useResetFormOnOpen(open, site, reset, (currentSite) => {
    setError('');
    return toFormValues(currentSite);
  });

  async function onSubmit(values: SeoSettingsFormValues) {
    setError('');
    try {
      await updateSeoSettings(values);
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('seoSettings.title')}</DialogTitle>
        </DialogHeader>
        {!site ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {t('seoSettings.indexingLabel')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('seoSettings.indexingDescription')}
                  </span>
                </div>
                <Controller
                  control={control}
                  name="searchEngineIndexingEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label={t('seoSettings.indexingLabel')}
                    />
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('seoSettings.indexingDisclaimer')}
              </p>
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
                {t('seoSettings.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t('seoSettings.saving') : t('seoSettings.save')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
