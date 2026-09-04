import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import type { BlockDescriptor } from '@brisk/block-registry';
import type {
  BlockStyleOverride,
  SiteRecord,
  ThemeBaseTokens,
} from '@brisk/shared-types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { blockStyleDefaultsQueryOptions } from './block-style-defaults-queries';
import type { BlockPickerCategory } from './canvas/block-picker';
import { BlockStyleFields } from './canvas/block-style-fields';
import { checkContrastAgainstThemeForeground } from '../lib/color-contrast';
import { useTranslation } from '../lib/use-translation';
import { availableThemesQueryOptions, siteQueryOptions } from './site-queries';
import { themeBaseTokensQueryOptions } from './theme-base-tokens-queries';
import { themeForegroundTokensQueryOptions } from './theme-foreground-tokens-queries';
import { ToggleableColorField } from './toggleable-color-field';
import { useResetFormOnOpen } from './use-reset-form-on-open';
import { useSiteThemePackage } from './use-site-theme-package';
import { useSiteThemeSettings } from './use-site-theme-settings';

export interface GlobalStylesDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Needed to build the "Style per block" list below — only types with a non-empty `stylableProperties` appear in it (docs/adr/0022). */
  registry: BlockDescriptor[];
  /** Stesse categorie/etichette del BlockPicker di inserimento, per un raggruppamento coerente in tutto l'editor. */
  categories: BlockPickerCategory[];
  /** Writes to `site.themeTokens.blockStyles[blockType]` and updates the CSS in the iframe live — shared with the toolbar's "Style" button (see canvas-editor-shell.tsx's saveTypeStyle). */
  onSaveTypeStyle: (
    blockType: string,
    style: BlockStyleOverride,
  ) => Promise<void>;
}

interface ColorsFormValues {
  primaryColorEnabled: boolean;
  primaryColor: string;
  secondaryColorEnabled: boolean;
  secondaryColor: string;
}

/**
 * When no Tier 1 override exists yet, show the active THEME's own color as
 * the starting value instead of a generic hardcoded one — this is the
 * actual point of `fetchThemeBaseTokens()`: a theme's base tokens should
 * be visible in the editor, not just baked invisibly into the public
 * render, so picking a theme and opening its style settings shows that
 * theme's real values as a starting point for further customization
 * (either here, or by editing the theme's own theme.css). Only applied
 * when the theme's token is a real hex color — themes whose theme.css
 * still uses oklch() (classic, unchanged) fall back to the old generic
 * default exactly as before, since a native `<input type="color">` can't
 * render an oklch() value.
 */
function toFormValues(
  site: SiteRecord,
  baseTokens: ThemeBaseTokens | undefined,
): ColorsFormValues {
  const themePrimary = baseTokens ? hexOrNull(baseTokens.primary) : null;
  const themeSecondary = baseTokens ? hexOrNull(baseTokens.secondary) : null;
  return {
    primaryColorEnabled: site.themePrimaryColor !== null,
    primaryColor: site.themePrimaryColor ?? themePrimary ?? '#18181b',
    secondaryColorEnabled: site.themeSecondaryColor !== null,
    secondaryColor: site.themeSecondaryColor ?? themeSecondary ?? '#71717a',
  };
}

function hexOrNull(value: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

/**
 * The global style editor (phase 2a of the visual editor plan, part 2;
 * extended in docs/adr/0022 part 2) — opened from an icon in the canvas's
 * top bar, not a page of its own. Two sections:
 * - "Colours": the two site-wide colours (primary/secondary), unchanged.
 * - "Style per block": a list of EVERY stylable block type on the site,
 *   clickable to edit its TYPE style (the same mechanism as the "Style"
 *   button in the selected block's toolbar, see BlockToolbarOverlay) — but
 *   reachable here for any type, even without already having an instance of
 *   it selected on the canvas. Font, custom CSS and scripts stay fully
 *   editable in the "Style" page — out of scope for a panel meant to be
 *   quick.
 */
export function GlobalStylesDialog({
  siteId,
  open,
  onOpenChange,
  registry,
  categories,
  onSaveTypeStyle,
}: GlobalStylesDialogProps) {
  const { t, tLabel } = useTranslation();
  const { data: site } = useQuery(siteQueryOptions(siteId));
  // The theme of the site this dialog is editing, not the app's default
  // one: the tokens and defaults shown have to be the ones the visitor will
  // actually see (docs/adr/0042).
  const activeThemeName = site?.themeName ?? '';
  const { data: blockStyleDefaults } = useQuery(
    blockStyleDefaultsQueryOptions(activeThemeName),
  );
  const { data: foregroundTokens } = useQuery(
    themeForegroundTokensQueryOptions(activeThemeName),
  );
  const { data: baseTokens } = useQuery(
    themeBaseTokensQueryOptions(activeThemeName),
  );
  const { data: availableThemes } = useQuery(availableThemesQueryOptions());
  const { updateThemeSettings, isSaving } = useSiteThemeSettings(siteId);
  const { updateThemePackage, isSaving: isSavingThemePackage } =
    useSiteThemePackage(siteId);

  const [error, setError] = useState('');
  const [themeError, setThemeError] = useState('');
  // Navigation between the list and one type's style — not form data, and
  // it always restarts from the list (not from the last type opened)
  // because reopening the dialog is a deliberate user action, not a
  // continuation of the last edit.
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch } = useForm<ColorsFormValues>({
    defaultValues: {
      primaryColorEnabled: false,
      primaryColor: '#18181b',
      secondaryColorEnabled: false,
      secondaryColor: '#71717a',
    },
  });
  // A live warning while the user picks the colour (docs/adr/0022's
  // contrast-check follow-up) — non-blocking; see color-contrast.ts for why
  // the comparison is against the active theme's real `--*-foreground`
  // token rather than a black/white guess.
  const primaryColorValue = watch('primaryColor');
  const primaryColorEnabled = watch('primaryColorEnabled');
  const secondaryColorValue = watch('secondaryColor');
  const secondaryColorEnabled = watch('secondaryColorEnabled');
  const primaryContrast =
    primaryColorEnabled && foregroundTokens
      ? checkContrastAgainstThemeForeground(
          primaryColorValue,
          foregroundTokens.primaryForeground,
        )
      : null;
  const secondaryContrast =
    secondaryColorEnabled && foregroundTokens
      ? checkContrastAgainstThemeForeground(
          secondaryColorValue,
          foregroundTokens.secondaryForeground,
        )
      : null;
  useResetFormOnOpen(open, site, reset, (currentSite) => {
    setError('');
    setThemeError('');
    setSelectedType(null);
    return toFormValues(currentSite, baseTokens);
  });

  async function onThemeChange(themeName: string) {
    setThemeError('');
    try {
      await updateThemePackage({ themeName });
    } catch (err) {
      setThemeError(String(err));
    }
  }

  async function onSubmit(values: ColorsFormValues) {
    if (!site) {
      return;
    }
    setError('');
    try {
      await updateThemeSettings({
        primaryColor: values.primaryColorEnabled
          ? hexOrNull(values.primaryColor)
          : null,
        secondaryColor: values.secondaryColorEnabled
          ? hexOrNull(values.secondaryColor)
          : null,
        fontFamily: site.themeFontFamily,
        customCss: site.themeCustomCss,
        headScript: site.themeHeadScript,
        bodyScript: site.themeBodyScript,
        faviconUrl: site.themeFaviconUrl,
        overridesEnabled: site.themeOverridesEnabled,
        allowedTrackerDomains: site.themeAllowedTrackerDomains,
        trackerScripts: site.themeTrackerScripts,
      });
    } catch (err) {
      setError(String(err));
    }
  }

  const styleableCategories = categories
    .map((category) => ({
      ...category,
      descriptors: category.types
        .map((type) => registry.find((block) => block.type === type))
        .filter(
          (descriptor): descriptor is BlockDescriptor =>
            !!descriptor && (descriptor.stylableProperties?.length ?? 0) > 0,
        ),
    }))
    .filter((category) => category.descriptors.length > 0);

  const selectedDescriptor = selectedType
    ? registry.find((d) => d.type === selectedType)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {selectedDescriptor
              ? t('canvas.style.editType', {
                  type: tLabel(selectedDescriptor.label),
                })
              : t('globalStyles.title')}
          </DialogTitle>
        </DialogHeader>
        {!site ? (
          <p className="text-sm text-muted-foreground">
            {t('globalStyles.loading')}
          </p>
        ) : selectedDescriptor ? (
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setSelectedType(null)}
            >
              <ChevronLeft size={16} />
              {t('globalStyles.back')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('canvas.style.editTypeHint', {
                type: tLabel(selectedDescriptor.label),
              })}
            </p>
            <BlockStyleFields
              properties={selectedDescriptor.stylableProperties ?? []}
              value={
                site.themeTokens?.blockStyles[selectedDescriptor.type] ?? {}
              }
              onChange={(next) =>
                void onSaveTypeStyle(selectedDescriptor.type, next)
              }
              defaults={blockStyleDefaults?.[selectedDescriptor.type]}
            />
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="flex max-h-[min(32rem,70vh)] flex-col gap-6 overflow-y-auto">
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-medium">
                  {t('globalStyles.colorsTitle')}
                </h3>
                <Controller
                  control={control}
                  name="primaryColor"
                  render={({ field: colorField }) => (
                    <Controller
                      control={control}
                      name="primaryColorEnabled"
                      render={({ field: enabledField }) => (
                        <>
                          <ToggleableColorField
                            id="global-styles-primary-color"
                            label={t('themeSettings.primaryColorLabel')}
                            overrideLabel={t('themeSettings.override')}
                            enabled={enabledField.value}
                            onEnabledChange={enabledField.onChange}
                            value={colorField.value}
                            onValueChange={colorField.onChange}
                          />
                          {!enabledField.value &&
                            hexOrNull(baseTokens?.primary ?? '') && (
                              <p className="text-xs text-muted-foreground">
                                {t('themeSettings.currentThemeValue')}
                              </p>
                            )}
                          {primaryContrast && !primaryContrast.passesAA && (
                            <p className="text-xs text-amber-600 dark:text-amber-500">
                              {t('themeSettings.contrastWarning', {
                                ratio: primaryContrast.ratio.toFixed(1),
                              })}
                            </p>
                          )}
                        </>
                      )}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="secondaryColor"
                  render={({ field: colorField }) => (
                    <Controller
                      control={control}
                      name="secondaryColorEnabled"
                      render={({ field: enabledField }) => (
                        <>
                          <ToggleableColorField
                            id="global-styles-secondary-color"
                            label={t('themeSettings.secondaryColorLabel')}
                            overrideLabel={t('themeSettings.override')}
                            enabled={enabledField.value}
                            onEnabledChange={enabledField.onChange}
                            value={colorField.value}
                            onValueChange={colorField.onChange}
                          />
                          {!enabledField.value &&
                            hexOrNull(baseTokens?.secondary ?? '') && (
                              <p className="text-xs text-muted-foreground">
                                {t('themeSettings.currentThemeValue')}
                              </p>
                            )}
                          {secondaryContrast && !secondaryContrast.passesAA && (
                            <p className="text-xs text-amber-600 dark:text-amber-500">
                              {t('themeSettings.contrastWarning', {
                                ratio: secondaryContrast.ratio.toFixed(1),
                              })}
                            </p>
                          )}
                        </>
                      )}
                    />
                  )}
                />
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving
                      ? t('globalStyles.saving')
                      : t('globalStyles.save')}
                  </Button>
                </div>
              </div>
              {site && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    {t('globalStyles.themeTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t('globalStyles.themeHint')}
                  </p>
                  <Select
                    value={site.themeName}
                    onValueChange={(value) => void onThemeChange(value)}
                    disabled={isSavingThemePackage}
                  >
                    <SelectTrigger id="global-styles-theme" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableThemes ?? []).map((theme) => (
                        <SelectItem key={theme.name} value={theme.name}>
                          {theme.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isSavingThemePackage && (
                    <p className="text-xs text-muted-foreground">
                      {t('globalStyles.themeSaving')}
                    </p>
                  )}
                  {themeError && (
                    <p role="alert" className="text-sm text-destructive">
                      {themeError}
                    </p>
                  )}
                </div>
              )}
              {styleableCategories.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    {t('globalStyles.blockStylesTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t('globalStyles.blockStylesHint')}
                  </p>
                  <Accordion type="multiple">
                    {styleableCategories.map((category) => (
                      <AccordionItem
                        key={category.title}
                        value={category.title}
                      >
                        <AccordionTrigger>
                          {tLabel(category.title)}
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="flex flex-col gap-0.5">
                            {category.descriptors.map((descriptor) => (
                              <li key={descriptor.type}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedType(descriptor.type)
                                  }
                                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground"
                                >
                                  {tLabel(descriptor.label)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}
            </div>
          </form>
        )}
        {!selectedDescriptor && site && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('globalStyles.close')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
