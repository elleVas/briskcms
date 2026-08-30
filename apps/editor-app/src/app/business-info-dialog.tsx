import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { OpeningHoursDay, SiteRecord } from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { OpeningHoursEditor } from './opening-hours-editor';
import { siteQueryOptions } from './site-queries';
import { useResetFormOnOpen } from './use-reset-form-on-open';
import { useSiteBusinessInfo } from './use-site-business-info';

const DAYS_OF_WEEK: OpeningHoursDay['dayOfWeek'][] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function emptyWeek(): OpeningHoursDay[] {
  return DAYS_OF_WEEK.map((dayOfWeek) => ({ dayOfWeek, ranges: [] }));
}

export interface BusinessInfoDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BusinessInfoFormValues {
  address: string;
  phone: string;
  businessType: string;
  openingHours: OpeningHoursDay[];
}

function toFormValues(site: SiteRecord): BusinessInfoFormValues {
  return {
    address: site.businessAddress ?? '',
    phone: site.businessPhone ?? '',
    businessType: site.businessType ?? '',
    openingHours: site.openingHours ?? emptyWeek(),
  };
}

export function BusinessInfoDialog({
  siteId,
  open,
  onOpenChange,
}: BusinessInfoDialogProps) {
  const { t } = useTranslation();
  // Gated on `open`: this dialog can be mounted for the app's whole
  // lifetime (rendered from SettingsMenu, present on every authenticated
  // route), so an unconditional query would fetch the site on every page
  // load whether or not the user ever opens the dialog.
  const { data: site } = useQuery({
    ...siteQueryOptions(siteId),
    enabled: open,
  });
  const { updateBusinessInfo, isSaving } = useSiteBusinessInfo(siteId);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, control, setValue } =
    useForm<BusinessInfoFormValues>({
      defaultValues: {
        address: '',
        phone: '',
        businessType: '',
        openingHours: emptyWeek(),
      },
    });
  useResetFormOnOpen(open, site, reset, (currentSite) => {
    setError('');
    return toFormValues(currentSite);
  });

  const openingHours = useWatch({ control, name: 'openingHours' });

  async function onSubmit(values: BusinessInfoFormValues) {
    setError('');
    try {
      await updateBusinessInfo({
        businessAddress: values.address.trim() || null,
        businessPhone: values.phone.trim() || null,
        businessType: values.businessType.trim() || null,
        openingHours: values.openingHours.some((day) => day.ranges.length > 0)
          ? values.openingHours
          : null,
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
          <DialogTitle>{t('businessInfo.title')}</DialogTitle>
        </DialogHeader>
        {!site ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
              <p className="text-sm text-muted-foreground">
                {t('businessInfo.description')}
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-address">
                  {t('businessInfo.addressLabel')}
                </Label>
                <Input id="business-address" {...register('address')} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-phone">
                  {t('businessInfo.phoneLabel')}
                </Label>
                <Input id="business-phone" {...register('phone')} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-type">
                  {t('businessInfo.typeLabel')}
                </Label>
                <Input
                  id="business-type"
                  placeholder={t('businessInfo.typePlaceholder')}
                  {...register('businessType')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('businessInfo.hoursLabel')}</Label>
                <OpeningHoursEditor
                  value={openingHours}
                  onChange={(next) => setValue('openingHours', next)}
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
                {t('businessInfo.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t('businessInfo.saving') : t('businessInfo.save')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
