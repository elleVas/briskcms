import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CURATED_THEME_FONTS } from '@brisk/shared-types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.js';
import { Switch } from '../components/ui/switch.js';
import { Textarea } from '../components/ui/textarea.js';
import { siteQueryOptions } from './site-queries.js';
import { useSiteThemeSettings } from './use-site-theme-settings.js';

export interface ThemeSettingsDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Distinct from every curated value in CURATED_THEME_FONTS — selecting it
// means "no site-level override", i.e. themeFontFamily stays `null` and
// the active filesystem theme's own default font applies (docs/adr/0021).
const INHERIT_THEME_FONT = '__inherit__';
const CUSTOM_FONT = '__custom__';
const CURATED_FONT_VALUES: string[] = CURATED_THEME_FONTS.map(
  (font) => font.value,
);

function hexOrNull(value: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

export function ThemeSettingsDialog({
  siteId,
  open,
  onOpenChange,
}: ThemeSettingsDialogProps) {
  const { t } = useTranslation();
  const { data: site } = useQuery({
    ...siteQueryOptions(siteId),
    enabled: open,
  });
  const { updateThemeSettings, isSaving } = useSiteThemeSettings(siteId);

  const [overridesEnabled, setOverridesEnabled] = useState(true);
  const [primaryColorEnabled, setPrimaryColorEnabled] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#18181b');
  const [secondaryColorEnabled, setSecondaryColorEnabled] = useState(false);
  const [secondaryColor, setSecondaryColor] = useState('#71717a');
  const [fontChoice, setFontChoice] = useState(INHERIT_THEME_FONT);
  const [customFontName, setCustomFontName] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [headScript, setHeadScript] = useState('');
  const [bodyScript, setBodyScript] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [error, setError] = useState('');

  // Same "adjust state during render" resync as the other settings dialogs
  // (GeneralSettingsDialog, SeoSettingsDialog) — this dialog stays mounted
  // for the app's lifetime, only `open`/`site` change.
  const [lastSyncKey, setLastSyncKey] = useState<string | null>(null);
  const syncKey = open ? `open:${site?.id ?? 'loading'}` : 'closed';
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    if (open && site) {
      setOverridesEnabled(site.themeOverridesEnabled);
      setPrimaryColorEnabled(site.themePrimaryColor !== null);
      setPrimaryColor(site.themePrimaryColor ?? '#18181b');
      setSecondaryColorEnabled(site.themeSecondaryColor !== null);
      setSecondaryColor(site.themeSecondaryColor ?? '#71717a');
      if (site.themeFontFamily === null) {
        setFontChoice(INHERIT_THEME_FONT);
        setCustomFontName('');
      } else if (CURATED_FONT_VALUES.includes(site.themeFontFamily)) {
        setFontChoice(site.themeFontFamily);
        setCustomFontName('');
      } else {
        setFontChoice(CUSTOM_FONT);
        setCustomFontName(site.themeFontFamily);
      }
      setCustomCss(site.themeCustomCss ?? '');
      setHeadScript(site.themeHeadScript ?? '');
      setBodyScript(site.themeBodyScript ?? '');
      setFaviconUrl(site.themeFaviconUrl ?? '');
      setError('');
    }
  }

  async function handleSubmit() {
    setError('');
    try {
      await updateThemeSettings({
        primaryColor: primaryColorEnabled ? hexOrNull(primaryColor) : null,
        secondaryColor: secondaryColorEnabled
          ? hexOrNull(secondaryColor)
          : null,
        fontFamily:
          fontChoice === INHERIT_THEME_FONT
            ? null
            : fontChoice === CUSTOM_FONT
              ? customFontName.trim() || null
              : fontChoice,
        customCss: customCss.trim() || null,
        headScript: headScript.trim() || null,
        bodyScript: bodyScript.trim() || null,
        faviconUrl: faviconUrl.trim() || null,
        overridesEnabled,
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
          <DialogTitle>{t('themeSettings.title')}</DialogTitle>
        </DialogHeader>
        {!site ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <>
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground">
                {t('themeSettings.intro')}
              </p>

              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {t('themeSettings.overridesEnabledLabel')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('themeSettings.overridesEnabledDescription')}
                  </span>
                </div>
                <Switch
                  checked={overridesEnabled}
                  onCheckedChange={setOverridesEnabled}
                  aria-label={t('themeSettings.overridesEnabledLabel')}
                />
              </div>

              <div
                className={`flex flex-col gap-4 ${overridesEnabled ? '' : 'opacity-50'}`}
                inert={!overridesEnabled || undefined}
                aria-disabled={!overridesEnabled}
              >
                <div className="flex flex-col gap-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="theme-settings-primary-color"
                      className="text-sm font-medium"
                    >
                      {t('themeSettings.primaryColorLabel')}
                    </Label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={primaryColorEnabled}
                        onChange={(event) =>
                          setPrimaryColorEnabled(event.target.checked)
                        }
                      />
                      {t('themeSettings.override')}
                    </label>
                  </div>
                  {primaryColorEnabled && (
                    <div className="flex items-center gap-2">
                      <input
                        id="theme-settings-primary-color"
                        type="color"
                        value={primaryColor}
                        onChange={(event) =>
                          setPrimaryColor(event.target.value)
                        }
                        className="h-9 w-14 rounded border border-input bg-transparent"
                      />
                      <span className="text-xs text-muted-foreground">
                        {primaryColor}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="theme-settings-secondary-color"
                      className="text-sm font-medium"
                    >
                      {t('themeSettings.secondaryColorLabel')}
                    </Label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={secondaryColorEnabled}
                        onChange={(event) =>
                          setSecondaryColorEnabled(event.target.checked)
                        }
                      />
                      {t('themeSettings.override')}
                    </label>
                  </div>
                  {secondaryColorEnabled && (
                    <div className="flex items-center gap-2">
                      <input
                        id="theme-settings-secondary-color"
                        type="color"
                        value={secondaryColor}
                        onChange={(event) =>
                          setSecondaryColor(event.target.value)
                        }
                        className="h-9 w-14 rounded border border-input bg-transparent"
                      />
                      <span className="text-xs text-muted-foreground">
                        {secondaryColor}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="theme-settings-font">
                    {t('themeSettings.fontLabel')}
                  </Label>
                  <Select value={fontChoice} onValueChange={setFontChoice}>
                    <SelectTrigger id="theme-settings-font" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={INHERIT_THEME_FONT}>
                        {t('themeSettings.fontInherit')}
                      </SelectItem>
                      {CURATED_THEME_FONTS.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_FONT}>
                        {t('themeSettings.fontCustom')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {fontChoice === CUSTOM_FONT && (
                    <Input
                      value={customFontName}
                      onChange={(event) =>
                        setCustomFontName(event.target.value)
                      }
                      placeholder={t('themeSettings.fontCustomPlaceholder')}
                    />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="theme-settings-favicon">
                    {t('themeSettings.faviconLabel')}
                  </Label>
                  <Input
                    id="theme-settings-favicon"
                    value={faviconUrl}
                    onChange={(event) => setFaviconUrl(event.target.value)}
                    placeholder="https://.../favicon.png"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="theme-settings-custom-css">
                    {t('themeSettings.customCssLabel')}
                  </Label>
                  <Textarea
                    id="theme-settings-custom-css"
                    value={customCss}
                    onChange={(event) => setCustomCss(event.target.value)}
                    rows={4}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="theme-settings-head-script">
                    {t('themeSettings.headScriptLabel')}
                  </Label>
                  <Textarea
                    id="theme-settings-head-script"
                    value={headScript}
                    onChange={(event) => setHeadScript(event.target.value)}
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="theme-settings-body-script">
                    {t('themeSettings.bodyScriptLabel')}
                  </Label>
                  <Textarea
                    id="theme-settings-body-script"
                    value={bodyScript}
                    onChange={(event) => setBodyScript(event.target.value)}
                    rows={3}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('themeSettings.scriptDisclaimer')}
                  </p>
                </div>
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
                {t('themeSettings.cancel')}
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSubmit()}
              >
                {isSaving ? t('themeSettings.saving') : t('themeSettings.save')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
