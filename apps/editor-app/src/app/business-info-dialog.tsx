import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { OpeningHoursDay } from '@brisk/shared-types';
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
import { OpeningHoursEditor } from './opening-hours-editor.js';
import { siteQueryOptions } from './site-queries.js';
import { useSiteBusinessInfo } from './use-site-business-info.js';

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

  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [openingHours, setOpeningHours] =
    useState<OpeningHoursDay[]>(emptyWeek());
  const [error, setError] = useState('');

  // Fills the form from the latest fetched site every time the dialog
  // opens — it stays mounted between opens, only `open` toggles, so a
  // previous edit session's local state would otherwise leak into the
  // next one. Adjusts state during render (comparing against the last
  // render's sync key) rather than in a useEffect, per
  // https://react.dev/learn/you-might-not-need-an-effect — `site` loads
  // asynchronously (the query is gated on `open`), so the key also
  // changes the moment it arrives, not just when `open` flips.
  const [lastSyncKey, setLastSyncKey] = useState<string | null>(null);
  const syncKey = open ? `open:${site?.id ?? 'loading'}` : 'closed';
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    if (open && site) {
      setAddress(site.businessAddress ?? '');
      setPhone(site.businessPhone ?? '');
      setBusinessType(site.businessType ?? '');
      setOpeningHours(site.openingHours ?? emptyWeek());
      setError('');
    }
  }

  async function handleSubmit() {
    setError('');
    try {
      await updateBusinessInfo({
        businessAddress: address.trim() || null,
        businessPhone: phone.trim() || null,
        businessType: businessType.trim() || null,
        openingHours: openingHours.some((day) => day.ranges.length > 0)
          ? openingHours
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
          <>
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
              <p className="text-sm text-muted-foreground">
                {t('businessInfo.description')}
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-address">
                  {t('businessInfo.addressLabel')}
                </Label>
                <Input
                  id="business-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-phone">
                  {t('businessInfo.phoneLabel')}
                </Label>
                <Input
                  id="business-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-type">
                  {t('businessInfo.typeLabel')}
                </Label>
                <Input
                  id="business-type"
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value)}
                  placeholder={t('businessInfo.typePlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('businessInfo.hoursLabel')}</Label>
                <OpeningHoursEditor
                  value={openingHours}
                  onChange={setOpeningHours}
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
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSubmit()}
              >
                {isSaving ? t('businessInfo.saving') : t('businessInfo.save')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
