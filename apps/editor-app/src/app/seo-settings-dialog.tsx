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
import { Switch } from '../components/ui/switch.js';
import { siteQueryOptions } from './site-queries.js';
import { useSiteSeoSettings } from './use-site-seo-settings.js';

export interface SeoSettingsDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  const [searchEngineIndexingEnabled, setSearchEngineIndexingEnabled] =
    useState(false);
  const [error, setError] = useState('');

  // Same "adjust state during render" resync as GeneralSettingsDialog.
  const [lastSyncKey, setLastSyncKey] = useState<string | null>(null);
  const syncKey = open ? `open:${site?.id ?? 'loading'}` : 'closed';
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    if (open && site) {
      setSearchEngineIndexingEnabled(site.searchEngineIndexingEnabled);
      setError('');
    }
  }

  async function handleSubmit() {
    setError('');
    try {
      await updateSeoSettings({ searchEngineIndexingEnabled });
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
          <>
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
                <Switch
                  checked={searchEngineIndexingEnabled}
                  onCheckedChange={setSearchEngineIndexingEnabled}
                  aria-label={t('seoSettings.indexingLabel')}
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
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSubmit()}
              >
                {isSaving ? t('seoSettings.saving') : t('seoSettings.save')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
