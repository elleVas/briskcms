import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CURATED_THEME_FONTS } from '@brisk/shared-types';
import { Button } from '../components/ui/button.js';
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
import type { SiteRecord } from '@brisk/shared-types';
import { ToggleableColorField } from './toggleable-color-field.js';
import { useSiteThemeSettings } from './use-site-theme-settings.js';

export interface StyleViewProps {
  siteId: string;
  site: SiteRecord;
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

function initialFontState(themeFontFamily: string | null) {
  if (themeFontFamily === null) {
    return { fontChoice: INHERIT_THEME_FONT, customFontName: '' };
  }
  if (CURATED_FONT_VALUES.includes(themeFontFamily)) {
    return { fontChoice: themeFontFamily, customFontName: '' };
  }
  return { fontChoice: CUSTOM_FONT, customFontName: themeFontFamily };
}

/**
 * A dedicated top-level page (not a Settings-menu dialog, per explicit
 * user feedback — the Style panel is its own concern, not a general app
 * preference like language/dark-mode). Tier 1 of docs/adr/0021's two-tier
 * theming model.
 */
export function StyleView({ siteId, site }: StyleViewProps) {
  const { t } = useTranslation();
  const { updateThemeSettings, isSaving } = useSiteThemeSettings(siteId);

  const initialFont = initialFontState(site.themeFontFamily);
  const [overridesEnabled, setOverridesEnabled] = useState(
    site.themeOverridesEnabled,
  );
  const [primaryColorEnabled, setPrimaryColorEnabled] = useState(
    site.themePrimaryColor !== null,
  );
  const [primaryColor, setPrimaryColor] = useState(
    site.themePrimaryColor ?? '#18181b',
  );
  const [secondaryColorEnabled, setSecondaryColorEnabled] = useState(
    site.themeSecondaryColor !== null,
  );
  const [secondaryColor, setSecondaryColor] = useState(
    site.themeSecondaryColor ?? '#71717a',
  );
  const [fontChoice, setFontChoice] = useState(initialFont.fontChoice);
  const [customFontName, setCustomFontName] = useState(
    initialFont.customFontName,
  );
  const [customCss, setCustomCss] = useState(site.themeCustomCss ?? '');
  const [headScript, setHeadScript] = useState(site.themeHeadScript ?? '');
  const [bodyScript, setBodyScript] = useState(site.themeBodyScript ?? '');
  const [faviconUrl, setFaviconUrl] = useState(site.themeFaviconUrl ?? '');
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

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
      setSavedAt(Date.now());
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('themeSettings.title')}</h1>
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
        <ToggleableColorField
          id="theme-settings-primary-color"
          label={t('themeSettings.primaryColorLabel')}
          overrideLabel={t('themeSettings.override')}
          enabled={primaryColorEnabled}
          onEnabledChange={setPrimaryColorEnabled}
          value={primaryColor}
          onValueChange={setPrimaryColor}
        />

        <ToggleableColorField
          id="theme-settings-secondary-color"
          label={t('themeSettings.secondaryColorLabel')}
          overrideLabel={t('themeSettings.override')}
          enabled={secondaryColorEnabled}
          onEnabledChange={setSecondaryColorEnabled}
          value={secondaryColor}
          onValueChange={setSecondaryColor}
        />

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
              onChange={(event) => setCustomFontName(event.target.value)}
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
          {isSaving ? t('themeSettings.saving') : t('themeSettings.save')}
        </Button>
        {savedAt > 0 && !isSaving && !error && (
          <span role="status" className="text-sm text-muted-foreground">
            {t('themeSettings.saved')}
          </span>
        )}
      </div>
    </div>
  );
}
