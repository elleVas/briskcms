import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import type { BlockDescriptor } from '@brisk/block-registry';
import type { BlockStyleOverride } from '@brisk/shared-types';
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
import { useTranslation } from '../lib/use-translation.js';
import { siteQueryOptions } from './site-queries.js';
import { ToggleableColorField } from './toggleable-color-field.js';
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
  const { updateThemeSettings, isSaving } = useSiteThemeSettings(siteId);

  const [primaryColorEnabled, setPrimaryColorEnabled] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#18181b');
  const [secondaryColorEnabled, setSecondaryColorEnabled] = useState(false);
  const [secondaryColor, setSecondaryColor] = useState('#71717a');
  const [error, setError] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Il dialog resta montato tra un'apertura e l'altra (stesso pattern di
  // SeoPanelDialog), ma qui `site` arriva da una query async — la chiave
  // combina "è aperto" ed "è già arrivato" (stesso approccio di
  // canvas-editor-shell.tsx's syncKey) così i campi si risincronizzano sia
  // quando si riapre con i dati già in cache, sia quando la query finisce
  // di caricare mentre il dialog è già aperto. Riparte sempre dall'elenco
  // (non dall'ultimo tipo aperto) — riaprire il dialog è un'azione
  // deliberata dell'utente, non una continuazione dell'ultima modifica.
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
      setSelectedType(null);
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
          <div className="flex max-h-[min(32rem,70vh)] flex-col gap-6 overflow-y-auto">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-medium">
                {t('globalStyles.colorsTitle')}
              </h3>
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
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                >
                  {isSaving ? t('globalStyles.saving') : t('globalStyles.save')}
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
                    <AccordionItem key={category.title} value={category.title}>
                      <AccordionTrigger>
                        {tLabel(category.title)}
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="flex flex-col gap-0.5">
                          {category.descriptors.map((descriptor) => (
                            <li key={descriptor.type}>
                              <button
                                type="button"
                                onClick={() => setSelectedType(descriptor.type)}
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
