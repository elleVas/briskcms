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
import { siteQueryOptions } from './site-queries.js';
import { ToggleableColorField } from './toggleable-color-field.js';
import { useSiteThemeSettings } from './use-site-theme-settings.js';

export interface GlobalStylesDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function hexOrNull(value: string): string | null {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

/**
 * Editor di stile globale (Fase 2a del piano editor visuale, parte 2) —
 * aperto da un'icona nella barra in alto del canvas, non una pagina a sé:
 * l'utente vuole applicare i colori base a tutto il sito senza uscire
 * dall'editor. Solo i due colori site-wide (primario/secondario) restano
 * qui — l'override "Bottoni" per-categoria è stato superseduto
 * (docs/adr/0022) dal meccanismo generico "Stile" nella toolbar del
 * canvas: selezioni QUALUNQUE blocco (non solo Button) e lo modifichi da
 * lì, un solo posto invece di due per lo stesso concetto. Font/CSS
 * personalizzato/script restano editabili per intero nella pagina
 * "Stile" — fuori scope per un pannello pensato per essere veloce.
 */
export function GlobalStylesDialog({
  siteId,
  open,
  onOpenChange,
}: GlobalStylesDialogProps) {
  const { t } = useTranslation();
  const { data: site } = useQuery(siteQueryOptions(siteId));
  const { updateThemeSettings, isSaving } = useSiteThemeSettings(siteId);

  const [primaryColorEnabled, setPrimaryColorEnabled] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#18181b');
  const [secondaryColorEnabled, setSecondaryColorEnabled] = useState(false);
  const [secondaryColor, setSecondaryColor] = useState('#71717a');
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
      setError('');
    }
  }

  async function handleSave() {
    if (!site) {
      return;
    }
    setError('');
    try {
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
    } catch (err) {
      setError(String(err));
    }
  }

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
          <div className="flex flex-col gap-4">
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
        )}
      </DialogContent>
    </Dialog>
  );
}
