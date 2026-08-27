import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { SiteRecord } from '@brisk/shared-types';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { siteQueryOptions } from './site-queries.js';
import { useResetFormOnOpen } from './use-reset-form-on-open.js';
import { useSiteGeneralSettings } from './use-site-general-settings.js';

export interface GeneralSettingsDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GeneralSettingsFormValues {
  name: string;
  domain: string;
}

function toFormValues(site: SiteRecord): GeneralSettingsFormValues {
  return { name: site.name, domain: site.domain ?? '' };
}

export function GeneralSettingsDialog({
  siteId,
  open,
  onOpenChange,
}: GeneralSettingsDialogProps) {
  const { t } = useTranslation();
  // Gated on `open`: same reasoning as BusinessInfoDialog — this dialog can
  // be mounted for the app's whole lifetime (rendered from SettingsMenu).
  const { data: site } = useQuery({
    ...siteQueryOptions(siteId),
    enabled: open,
  });
  const { updateGeneralSettings, isSaving } = useSiteGeneralSettings(siteId);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, control } =
    useForm<GeneralSettingsFormValues>({
      defaultValues: { name: '', domain: '' },
    });
  useResetFormOnOpen(open, site, reset, (currentSite) => {
    setError('');
    return toFormValues(currentSite);
  });
  const name = useWatch({ control, name: 'name' });

  async function onSubmit(values: GeneralSettingsFormValues) {
    setError('');
    try {
      await updateGeneralSettings({
        name: values.name.trim(),
        domain: values.domain.trim() || null,
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
          <DialogTitle>{t('generalSettings.title')}</DialogTitle>
        </DialogHeader>
        {!site ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="general-settings-name">
                  {t('generalSettings.nameLabel')}
                </Label>
                <Input
                  id="general-settings-name"
                  {...register('name', { required: true })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="general-settings-domain">
                  {t('generalSettings.domainLabel')}
                </Label>
                <Input
                  id="general-settings-domain"
                  placeholder="www.iltuosito.it"
                  {...register('domain')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('generalSettings.domainDescription')}
                </p>
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
                {t('generalSettings.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSaving || name.trim().length === 0}
              >
                {isSaving
                  ? t('generalSettings.saving')
                  : t('generalSettings.save')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
