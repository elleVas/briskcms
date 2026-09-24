import { z } from 'zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type {
  BusinessAddress,
  OpeningHoursDay,
  SiteRecord,
} from '@brisk/shared-types';
import {
  EMPTY_BUSINESS_ADDRESS,
  ISO_COUNTRY_CODES,
  isBusinessAddressEmpty,
} from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { NativeSelect } from '../components/ui/native-select';
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
  address: BusinessAddress;
  phone: string;
  email: string;
  businessType: string;
  openingHours: OpeningHoursDay[];
}

function toFormValues(site: SiteRecord): BusinessInfoFormValues {
  return {
    address: site.businessAddress ?? EMPTY_BUSINESS_ADDRESS,
    phone: site.businessPhone ?? '',
    email: site.businessEmail ?? '',
    businessType: site.businessType ?? '',
    openingHours: site.openingHours ?? emptyWeek(),
  };
}

export function BusinessInfoDialog({
  siteId,
  open,
  onOpenChange,
}: BusinessInfoDialogProps) {
  const { t, i18n } = useTranslation();
  // Gated on `open`: this dialog can be mounted for the app's whole
  // lifetime (rendered from SettingsMenu, present on every authenticated
  // route), so an unconditional query would fetch the site on every page
  // load whether or not the user ever opens the dialog.
  const { data: site } = useQuery({
    ...siteQueryOptions(),
    enabled: open,
  });
  const { updateBusinessInfo, isSaving } = useSiteBusinessInfo(siteId);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<BusinessInfoFormValues>({
    defaultValues: {
      address: EMPTY_BUSINESS_ADDRESS,
      phone: '',
      email: '',
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
        businessAddress: isBusinessAddressEmpty(values.address)
          ? null
          : trimBusinessAddress(values.address),
        businessPhone: values.phone.trim() || null,
        businessEmail: values.email.trim() || null,
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
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">
                  {t('businessInfo.addressLabel')}
                </legend>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="business-address-street">
                    {t('businessInfo.streetLabel')}
                  </Label>
                  <Input
                    id="business-address-street"
                    {...register('address.street')}
                  />
                </div>
                {/* Postcode and town on one row: they are one line of the
                    address, and giving each a full row of its own made the
                    dialog read as four unrelated questions. */}
                <div className="flex gap-2">
                  <div className="flex w-32 shrink-0 flex-col gap-2">
                    <Label htmlFor="business-address-postal-code">
                      {t('businessInfo.postalCodeLabel')}
                    </Label>
                    <Input
                      id="business-address-postal-code"
                      {...register('address.postalCode')}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Label htmlFor="business-address-city">
                      {t('businessInfo.cityLabel')}
                    </Label>
                    <Input
                      id="business-address-city"
                      {...register('address.city')}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="business-address-country">
                    {t('businessInfo.countryLabel')}
                  </Label>
                  {/* Native, so a phone offers its own picker and a
                      keyboard can type-ahead through 249 entries. The
                      names are the platform's — no table of countries to
                      translate or keep up to date, see ISO_COUNTRY_CODES. */}
                  <NativeSelect
                    id="business-address-country"
                    {...register('address.country')}
                  >
                    <option value="">{t('businessInfo.countryNone')}</option>
                    {countryOptions(i18n.language).map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </fieldset>
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-phone">
                  {t('businessInfo.phoneLabel')}
                </Label>
                <Input id="business-phone" {...register('phone')} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-email">
                  {t('businessInfo.emailLabel')}
                </Label>
                {/* Checked here as well as by the API, so a typo is a line
                    under the field and not "something went wrong" after
                    pressing Save. Empty is fine: not every business
                    publishes an address to write to. */}
                {/* `inputMode`, not `type="email"`: the same keyboard on a
                    phone, without the browser's own validation popping a
                    different message, by different rules, before this one. */}
                <Input
                  id="business-email"
                  inputMode="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={
                    errors.email ? 'business-email-error' : undefined
                  }
                  {...register('email', {
                    validate: (value) =>
                      value.trim() === '' ||
                      z.string().email().safeParse(value.trim()).success ||
                      t('businessInfo.emailInvalid'),
                  })}
                />
                {errors.email && (
                  <p
                    id="business-email-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors.email.message}
                  </p>
                )}
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

/**
 * The countries, named in the editor's own language and sorted the way
 * that language sorts — which is why the sort happens here and not in the
 * list of codes: "Österreich" files under O in German and after Z with a
 * naive comparison.
 */
function countryOptions(locale: string): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  const collator = new Intl.Collator(locale);
  return ISO_COUNTRY_CODES.map((code) => ({
    code,
    name: names.of(code) ?? code,
  })).sort((a, b) => collator.compare(a.name, b.name));
}

/** Stored without the spaces somebody typed around a part. */
function trimBusinessAddress(address: BusinessAddress): BusinessAddress {
  return {
    street: address.street.trim(),
    postalCode: address.postalCode.trim(),
    city: address.city.trim(),
    country: address.country.trim(),
  };
}
