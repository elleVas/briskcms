import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { cn } from '../lib/utils.js';
import { siteQueryOptions } from './site-queries.js';
import { ToggleableColorField } from './toggleable-color-field.js';
import { useSiteThemeSettings } from './use-site-theme-settings.js';
import { useSiteThemeTokens } from './use-site-theme-tokens.js';

export interface GlobalStylesDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Category = 'colors' | 'buttons';

function hexOrNull(value: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Editor di stile globale (Fase 2a del piano editor visuale, parte 2) —
 * aperto da un'icona nella barra in alto del canvas, non una pagina a sé:
 * l'utente vuole applicare colori/bottoni a tutto il sito senza uscire
 * dall'editor. Solo 2 categorie oggi (Colori, Bottoni) — le altre
 * (Typography, Cards, Tables, Footer...) restano backlog dichiarato, non
 * silenzioso (vedi il piano). "Colori" qui è un sottoinsieme minimo
 * (primario/secondario) delle impostazioni tema complete, che restano
 * editabili per intero nella pagina "Stile" — non duplicate qui font/CSS
 * personalizzato/script, fuori scope per un pannello pensato per essere
 * veloce.
 */
export function GlobalStylesDialog({
  siteId,
  open,
  onOpenChange,
}: GlobalStylesDialogProps) {
  const { t } = useTranslation();
  const { data: site } = useQuery(siteQueryOptions(siteId));
  const { updateThemeSettings, isSaving: isSavingColors } =
    useSiteThemeSettings(siteId);
  const { updateThemeTokens, isSaving: isSavingButtons } =
    useSiteThemeTokens(siteId);

  const [category, setCategory] = useState<Category>('colors');
  const [primaryColorEnabled, setPrimaryColorEnabled] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#18181b');
  const [secondaryColorEnabled, setSecondaryColorEnabled] = useState(false);
  const [secondaryColor, setSecondaryColor] = useState('#71717a');
  const [borderRadius, setBorderRadius] = useState('');
  const [paddingX, setPaddingX] = useState('');
  const [paddingY, setPaddingY] = useState('');
  const [error, setError] = useState('');

  // Il dialog resta montato tra un'apertura e l'altra (stesso pattern di
  // SeoPanelDialog), ma qui `site` arriva da una query async — la chiave
  // combina "è aperto" ed "è già arrivato" (stesso approccio di
  // canvas-editor-shell.tsx's syncKey) così i campi si risincronizzano sia
  // quando si riapre con i dati già in cache, sia quando la query finisce
  // di caricare mentre il dialog è già aperto.
  const syncKey = `${open}:${site ? 'ready' : 'loading'}`;
  const [lastSyncKey, setLastSyncKey] = useState(syncKey);
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    if (open && site) {
      setPrimaryColorEnabled(site.themePrimaryColor !== null);
      setPrimaryColor(site.themePrimaryColor ?? '#18181b');
      setSecondaryColorEnabled(site.themeSecondaryColor !== null);
      setSecondaryColor(site.themeSecondaryColor ?? '#71717a');
      setBorderRadius(site.themeTokens?.buttons.borderRadius ?? '');
      setPaddingX(site.themeTokens?.buttons.paddingX ?? '');
      setPaddingY(site.themeTokens?.buttons.paddingY ?? '');
      setError('');
    }
  }

  async function handleSave() {
    if (!site) {
      return;
    }
    setError('');
    try {
      if (category === 'colors') {
        await updateThemeSettings({
          primaryColor: primaryColorEnabled ? hexOrNull(primaryColor) : null,
          secondaryColor: secondaryColorEnabled
            ? hexOrNull(secondaryColor)
            : null,
          fontFamily: site.themeFontFamily,
          customCss: site.themeCustomCss,
          headScript: site.themeHeadScript,
          bodyScript: site.themeBodyScript,
          faviconUrl: site.themeFaviconUrl,
          overridesEnabled: site.themeOverridesEnabled,
        });
      } else {
        await updateThemeTokens({
          buttons: {
            borderRadius: trimmedOrNull(borderRadius),
            paddingX: trimmedOrNull(paddingX),
            paddingY: trimmedOrNull(paddingY),
          },
        });
      }
    } catch (err) {
      setError(String(err));
    }
  }

  const isSaving = category === 'colors' ? isSavingColors : isSavingButtons;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('globalStyles.title')}</DialogTitle>
        </DialogHeader>
        {!site ? (
          <p className="text-sm text-muted-foreground">
            {t('globalStyles.loading')}
          </p>
        ) : (
          <div className="flex gap-4">
            <nav className="flex w-40 shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => setCategory('colors')}
                className={cn(
                  'rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
                  category === 'colors' && 'bg-muted font-medium',
                )}
              >
                {t('globalStyles.categories.colors')}
              </button>
              <button
                type="button"
                onClick={() => setCategory('buttons')}
                className={cn(
                  'rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
                  category === 'buttons' && 'bg-muted font-medium',
                )}
              >
                {t('globalStyles.categories.buttons')}
              </button>
            </nav>
            <div className="flex flex-1 flex-col gap-4">
              {category === 'colors' && (
                <>
                  <ToggleableColorField
                    id="global-styles-primary-color"
                    label={t('themeSettings.primaryColorLabel')}
                    overrideLabel={t('themeSettings.override')}
                    enabled={primaryColorEnabled}
                    onEnabledChange={setPrimaryColorEnabled}
                    value={primaryColor}
                    onValueChange={setPrimaryColor}
                  />
                  <ToggleableColorField
                    id="global-styles-secondary-color"
                    label={t('themeSettings.secondaryColorLabel')}
                    overrideLabel={t('themeSettings.override')}
                    enabled={secondaryColorEnabled}
                    onEnabledChange={setSecondaryColorEnabled}
                    value={secondaryColor}
                    onValueChange={setSecondaryColor}
                  />
                </>
              )}
              {category === 'buttons' && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="global-styles-button-radius">
                      {t('globalStyles.buttonRadiusLabel')}
                    </Label>
                    <Input
                      id="global-styles-button-radius"
                      value={borderRadius}
                      onChange={(event) => setBorderRadius(event.target.value)}
                      placeholder={t('globalStyles.buttonRadiusPlaceholder')}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="global-styles-button-padding-x">
                      {t('globalStyles.buttonPaddingXLabel')}
                    </Label>
                    <Input
                      id="global-styles-button-padding-x"
                      value={paddingX}
                      onChange={(event) => setPaddingX(event.target.value)}
                      placeholder={t('globalStyles.paddingPlaceholder')}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="global-styles-button-padding-y">
                      {t('globalStyles.buttonPaddingYLabel')}
                    </Label>
                    <Input
                      id="global-styles-button-padding-y"
                      value={paddingY}
                      onChange={(event) => setPaddingY(event.target.value)}
                      placeholder={t('globalStyles.paddingPlaceholder')}
                    />
                  </div>
                </>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  {t('globalStyles.close')}
                </Button>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                >
                  {isSaving ? t('globalStyles.saving') : t('globalStyles.save')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
