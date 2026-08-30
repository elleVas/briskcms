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
} from '../components/ui/accordion.js';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';
import { blockStyleDefaultsQueryOptions } from './block-style-defaults-queries.js';
import type { BlockPickerCategory } from './canvas/block-picker.js';
import { BlockStyleFields } from './canvas/block-style-fields.js';
import { checkContrastAgainstThemeForeground } from '../lib/color-contrast.js';
import { useTranslation } from '../lib/use-translation.js';
import { siteQueryOptions } from './site-queries.js';
import { themeBaseTokensQueryOptions } from './theme-base-tokens-queries.js';
import { themeForegroundTokensQueryOptions } from './theme-foreground-tokens-queries.js';
import { ToggleableColorField } from './toggleable-color-field.js';
import { useResetFormOnOpen } from './use-reset-form-on-open.js';
import { useSiteThemeSettings } from './use-site-theme-settings.js';

export interface GlobalStylesDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Serve a costruire l'elenco "Stile per blocco" sotto — solo i tipi con `stylableProperties` non vuoto vi compaiono (docs/adr/0022). */
  registry: BlockDescriptor[];
  /** Stesse categorie/etichette del BlockPicker di inserimento, per un raggruppamento coerente in tutto l'editor. */
  categories: BlockPickerCategory[];
  /** Scrive su `site.themeTokens.blockStyles[blockType]` e aggiorna dal vivo il CSS nell'iframe — condivisa con il pulsante "Stile" della toolbar (vedi canvas-editor-shell.tsx's saveTypeStyle). */
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
 * Editor di stile globale (Fase 2a del piano editor visuale, parte 2;
 * estesa in docs/adr/0022 parte 2) — aperto da un'icona nella barra in
 * alto del canvas, non una pagina a sé. Due sezioni:
 * - "Colori": i due colori site-wide (primario/secondario), invariata.
 * - "Stile per blocco": elenco di OGNI tipo di blocco stilizzabile del
 *   sito, cliccabile per modificarne lo stile di TIPO (stesso meccanismo
 *   del pulsante "Stile" nella toolbar del blocco selezionato, vedi
 *   BlockToolbarOverlay) — ma qui accessibile per qualunque tipo, anche
 *   senza averne già un'istanza selezionata sul canvas. Font/CSS
 *   personalizzato/script restano editabili per intero nella pagina
 *   "Stile" — fuori scope per un pannello pensato per essere veloce.
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
  const { data: blockStyleDefaults } = useQuery(
    blockStyleDefaultsQueryOptions(),
  );
  const { data: foregroundTokens } = useQuery(
    themeForegroundTokensQueryOptions(),
  );
  const { data: baseTokens } = useQuery(themeBaseTokensQueryOptions());
  const { updateThemeSettings, isSaving } = useSiteThemeSettings(siteId);

  const [error, setError] = useState('');
  // Navigazione tra l'elenco e lo stile di un tipo — non dati di un form,
  // riparte sempre dall'elenco (non dall'ultimo tipo aperto) perché
  // riaprire il dialog è un'azione deliberata dell'utente, non una
  // continuazione dell'ultima modifica.
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch } = useForm<ColorsFormValues>({
    defaultValues: {
      primaryColorEnabled: false,
      primaryColor: '#18181b',
      secondaryColorEnabled: false,
      secondaryColor: '#71717a',
    },
  });
  // Avviso dal vivo mentre l'utente sceglie il colore (docs/adr/0022's
  // follow-up sul controllo di contrasto) — non bloccante, vedi
  // color-contrast.ts per perché il confronto è contro il vero token
  // `--*-foreground` del tema attivo, non un'ipotesi bianco/nero.
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
    setSelectedType(null);
    return toFormValues(currentSite, baseTokens);
  });

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
