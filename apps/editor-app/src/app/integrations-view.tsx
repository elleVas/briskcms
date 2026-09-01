import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SiteRecord,
  TrackerDomainEntry,
  TrackerScriptEntry,
} from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { TrackerDomainListEditor } from './tracker-domain-list-editor';
import { TrackerScriptListEditor } from './tracker-script-list-editor';
import { useSiteThemeSettings } from './use-site-theme-settings';

export interface IntegrationsViewProps {
  siteId: string;
  site: SiteRecord;
}

/**
 * A dedicated top-level page, same reasoning as StyleView (docs/adr/0021's
 * own precedent) — third-party scripts/trackers are their own concern, not
 * "style". Head/body script fields lived in StyleView until ADR-0031 moved
 * them here alongside the new tracker domain whitelist: both are about
 * what third-party code this site runs and talks to, gated by the same
 * admin-only endpoint, independent of StyleView's own `overridesEnabled`
 * switch (a tracker shouldn't stop running just because someone toggled
 * off color/font overrides).
 */
export function IntegrationsView({ siteId, site }: IntegrationsViewProps) {
  const { t } = useTranslation();
  const { updateThemeSettings, isSaving } = useSiteThemeSettings(siteId);

  const [headScript, setHeadScript] = useState(site.themeHeadScript ?? '');
  const [bodyScript, setBodyScript] = useState(site.themeBodyScript ?? '');
  const [allowedTrackerDomains, setAllowedTrackerDomains] = useState<
    TrackerDomainEntry[]
  >(site.themeAllowedTrackerDomains);
  const [trackerScripts, setTrackerScripts] = useState<TrackerScriptEntry[]>(
    site.themeTrackerScripts,
  );
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  async function handleSubmit() {
    setError('');
    try {
      const updated = await updateThemeSettings({
        // Owned by StyleView, not this page — round-tripped unchanged
        // since updateThemeSettings always replaces the whole object (see
        // Site.updateThemeSettings, no partial-patch support).
        primaryColor: site.themePrimaryColor,
        secondaryColor: site.themeSecondaryColor,
        fontFamily: site.themeFontFamily,
        customCss: site.themeCustomCss,
        faviconUrl: site.themeFaviconUrl,
        overridesEnabled: site.themeOverridesEnabled,
        headScript: headScript.trim() || null,
        bodyScript: bodyScript.trim() || null,
        allowedTrackerDomains,
        trackerScripts,
      });
      // The save may have auto-detected a known vendor (docs/adr/0039) and
      // moved it out of headScript/bodyScript into themeTrackerScripts —
      // re-sync local state from the server's actual result instead of
      // what was submitted, or the form would keep showing the
      // now-duplicated snippet until a full remount.
      setHeadScript(updated.themeHeadScript ?? '');
      setBodyScript(updated.themeBodyScript ?? '');
      setTrackerScripts(updated.themeTrackerScripts);
      setSavedAt(Date.now());
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('integrations.title')}</h1>
      <p className="text-xs text-muted-foreground">{t('integrations.intro')}</p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="integrations-head-script">
          {t('integrations.headScriptLabel')}
        </Label>
        <Textarea
          id="integrations-head-script"
          value={headScript}
          onChange={(event) => setHeadScript(event.target.value)}
          rows={3}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="integrations-body-script">
          {t('integrations.bodyScriptLabel')}
        </Label>
        <Textarea
          id="integrations-body-script"
          value={bodyScript}
          onChange={(event) => setBodyScript(event.target.value)}
          rows={3}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          {t('integrations.scriptDisclaimer')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('integrations.trackerDomainsLabel')}</Label>
        <TrackerDomainListEditor
          entries={allowedTrackerDomains}
          onChange={setAllowedTrackerDomains}
        />
        <p className="text-xs text-muted-foreground">
          {t('integrations.trackerDomainsDisclaimer')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>{t('integrations.trackerScriptsLabel')}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSaving}
            onClick={() => void handleSubmit()}
          >
            {t('integrations.detectAgain')}
          </Button>
        </div>
        <TrackerScriptListEditor
          entries={trackerScripts}
          onChange={setTrackerScripts}
        />
        <p className="text-xs text-muted-foreground">
          {t('integrations.trackerScriptsDisclaimer')}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSubmit()}
        >
          {isSaving ? t('integrations.saving') : t('integrations.save')}
        </Button>
        {savedAt > 0 && !isSaving && !error && (
          <span role="status" className="text-sm text-muted-foreground">
            {t('integrations.saved')}
          </span>
        )}
      </div>
    </div>
  );
}
