import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CURATED_THEME_FONTS } from '@brisk/shared-types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import type { SiteRecord } from '@brisk/shared-types';
import { checkContrastAgainstThemeForeground } from '../lib/color-contrast';
import { themeForegroundTokensQueryOptions } from './theme-foreground-tokens-queries';
import { ToggleableColorField } from './toggleable-color-field';
import { useSiteThemeSettings } from './use-site-theme-settings';

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
  const { data: foregroundTokens } = useQuery(
    themeForegroundTokensQueryOptions(site.themeName),
  );

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
  const [faviconUrl, setFaviconUrl] = useState(site.themeFaviconUrl ?? '');
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  // The same non-blocking warning as GlobalStylesDialog (docs/adr/0022's
  // contrast follow-up) — duplicated here because this view also duplicates
  // the colour fields themselves (local state rather than the shared form),
  // not a second mechanism.
  const primaryContrast =
    primaryColorEnabled && foregroundTokens
      ? checkContrastAgainstThemeForeground(
          primaryColor,
          foregroundTokens.primaryForeground,
        )
      : null;
  const secondaryContrast =
    secondaryColorEnabled && foregroundTokens
      ? checkContrastAgainstThemeForeground(
          secondaryColor,
          foregroundTokens.secondaryForeground,
        )
      : null;

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
        // Owned by IntegrationsView now, not this page — round-tripped
        // unchanged since updateThemeSettings always replaces the whole
        // object (see Site.updateThemeSettings, no partial-patch support).
        headScript: site.themeHeadScript,
        bodyScript: site.themeBodyScript,
        allowedTrackerDomains: site.themeAllowedTrackerDomains,
        trackerScripts: site.themeTrackerScripts,
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
        <div className="flex flex-col gap-1.5">
          <ToggleableColorField
            id="theme-settings-primary-color"
            label={t('themeSettings.primaryColorLabel')}
            overrideLabel={t('themeSettings.override')}
            enabled={primaryColorEnabled}
            onEnabledChange={setPrimaryColorEnabled}
            value={primaryColor}
            onValueChange={setPrimaryColor}
          />
          {primaryContrast && !primaryContrast.passesAA && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t('themeSettings.contrastWarning', {
                ratio: primaryContrast.ratio.toFixed(1),
              })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <ToggleableColorField
            id="theme-settings-secondary-color"
            label={t('themeSettings.secondaryColorLabel')}
            overrideLabel={t('themeSettings.override')}
            enabled={secondaryColorEnabled}
            onEnabledChange={setSecondaryColorEnabled}
            value={secondaryColor}
            onValueChange={setSecondaryColor}
          />
          {secondaryContrast && !secondaryContrast.passesAA && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t('themeSettings.contrastWarning', {
                ratio: secondaryContrast.ratio.toFixed(1),
              })}
            </p>
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
