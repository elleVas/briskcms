import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
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
import { useSiteGeneralSettings } from './use-site-general-settings.js';

export interface GeneralSettingsDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');

  // Same "adjust state during render" resync as BusinessInfoDialog — this
  // dialog stays mounted between opens, only `open` toggles, and `site`
  // loads asynchronously (gated on `open`), so the key changes the moment
  // it arrives too, not just when `open` flips.
  const [lastSyncKey, setLastSyncKey] = useState<string | null>(null);
  const syncKey = open ? `open:${site?.id ?? 'loading'}` : 'closed';
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    if (open && site) {
      setName(site.name);
      setDomain(site.domain ?? '');
      setError('');
    }
  }

  async function handleSubmit() {
    setError('');
    try {
      await updateGeneralSettings({
        name: name.trim(),
        domain: domain.trim() || null,
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
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="general-settings-name">
                  {t('generalSettings.nameLabel')}
                </Label>
                <Input
                  id="general-settings-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="general-settings-domain">
                  {t('generalSettings.domainLabel')}
                </Label>
                <Input
                  id="general-settings-domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="www.iltuosito.it"
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
                type="button"
                disabled={isSaving || name.trim().length === 0}
                onClick={() => void handleSubmit()}
              >
                {isSaving
                  ? t('generalSettings.saving')
                  : t('generalSettings.save')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
