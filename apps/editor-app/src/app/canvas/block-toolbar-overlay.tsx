import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Paintbrush,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Block, BlockRect, BlockStyleOverride } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover.js';
import { BlockPicker, type BlockPickerCategory } from './block-picker.js';
import { BlockStyleFields } from './block-style-fields.js';
import { InspectorPanel } from './inspector-panel.js';
import { useIframeGeometry, type IframeGeometry } from './overlay-layer.js';

export interface BlockToolbarOverlayProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  block: Block;
  descriptor: BlockDescriptor;
  rect: BlockRect;
  /** Vero solo per un blocco di primo livello — sposta/inserisci-fratello sono scoped a quello stesso livello del riordino via drag (vedi compute-drop-target.ts). */
  isRootLevel: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  registry: BlockDescriptor[];
  categories: BlockPickerCategory[];
  onChangeProp: (key: string, value: unknown) => void;
  /**
   * Override "a livello di componente" (docs/adr/0022) — valore corrente
   * per il TIPO del blocco selezionato (`site.themeTokens.blockStyles[tipo]
   * ?? {}`), tocca OGNI istanza di quel tipo sul sito. Entrambi assenti
   * quando non c'è ancora un sito da cui leggerlo (query non arrivata, o
   * nessun `siteId` — vedi canvas-editor-shell.tsx): il pulsante "Stile"
   * semplicemente non appare finché non lo sono.
   */
  typeStyle?: BlockStyleOverride;
  onChangeTypeStyle?: (style: BlockStyleOverride) => void;
  /** Override per-ISTANZA (docs/adr/0022) — solo `block` stesso, letto da `block.styleOverride` direttamente (non serve una prop separata). */
  onChangeInstanceStyle: (style: BlockStyleOverride) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onInsertBefore: (descriptor: BlockDescriptor) => void;
  onInsertAfter: (descriptor: BlockDescriptor) => void;
  /** Presente solo per un contenitore "a collezione" (un solo tipo in `allowedChildTypes`, es. Testimonianze→Testimonianza) — aggiunge un altro figlio di quel tipo direttamente, nessun picker: l'unico tipo sensato è già noto. */
  onAddChild?: () => void;
}

/**
 * `position: 'fixed'` — questo overlay vive dentro un contenitore
 * (canvas-editor-shell.tsx) che di per sé è già co-locato con il box
 * dell'iframe, quindi un `absolute` sommerebbe l'offset dell'iframe una
 * seconda volta sopra quello già dato dal genitore posizionato. `fixed`
 * ignora la gerarchia degli antenati e usa direttamente le coordinate
 * viewport di `geometry`/`rect` (stessa semantica di
 * `getBoundingClientRect()`, vedi `useIframeGeometry`), l'unica cosa per
 * cui questa traduzione è corretta.
 */
function toPillStyle(geometry: IframeGeometry, rect: BlockRect) {
  return {
    position: 'fixed' as const,
    top: geometry.top + rect.top - 28,
    left: geometry.left + rect.left,
  };
}

/** Larghezza approssimata della colonna di icone (28px bottone + padding/bordo) — serve solo a decidere se c'è spazio a destra del blocco, non per il layout reale. */
const TOOLBAR_WIDTH_PX = 40;
const TOOLBAR_GAP_PX = 8;

/**
 * Per un blocco a tutta larghezza (il caso comune per i blocchi di primo
 * livello) posizionarla a `rect.left + rect.width + 8` la spingerebbe fuori
 * dall'iframe — bloccata qui dentro al bordo destro dell'iframe stesso, che
 * per un blocco full-width coincide con il bordo destro del blocco.
 */
function toToolbarStyle(geometry: IframeGeometry, rect: BlockRect) {
  const preferredLeft = geometry.left + rect.left + rect.width + TOOLBAR_GAP_PX;
  const maxLeft =
    geometry.left + geometry.width - TOOLBAR_WIDTH_PX - TOOLBAR_GAP_PX;
  return {
    position: 'fixed' as const,
    top: geometry.top + rect.top,
    left: Math.min(preferredLeft, maxLeft),
  };
}

function toInsertPointStyle(
  geometry: IframeGeometry,
  rect: BlockRect,
  edge: 'top' | 'bottom',
) {
  return {
    position: 'fixed' as const,
    top:
      geometry.top + (edge === 'top' ? rect.top : rect.top + rect.height) - 12,
    left: geometry.left + rect.left + rect.width / 2 - 12,
  };
}

/**
 * A differenza di `toInsertPointStyle` (che STRADDLES il bordo del blocco,
 * per un fratello a livello di pagina — e per un blocco di primo livello
 * compare proprio sul bordo INFERIORE), questo resta DENTRO al rettangolo
 * del contenitore stesso, nell'angolo in alto a destra: visivamente
 * "aggiungi qui dentro", non "inserisci un fratello altrove". Centrato sul
 * bordo destro (invece che nell'angolo) finiva quasi sempre sovrapposto ai
 * pulsanti di navigazione di Testimonianze (anch'essi centrati
 * verticalmente lì); sul bordo inferiore finiva invece sovrapposto al "+"
 * radice di un blocco di primo livello — entrambi osservati dal vivo.
 */
function toAddChildStyle(geometry: IframeGeometry, rect: BlockRect) {
  return {
    position: 'fixed' as const,
    top: geometry.top + rect.top + 4,
    left: geometry.left + rect.left + rect.width - 32,
  };
}

const iconButtonClass =
  'flex h-7 w-7 items-center justify-center rounded border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Toolbar contestuale ancorata al blocco selezionato (Fase 1 del piano
 * "editor visuale, parte 2") — sostituisce la colonna Inspector fissa:
 * breadcrumb, sposta su/giù, scorciatoia colore, proprietà via popover,
 * duplica, elimina, punti di inserimento sopra/sotto. Stessa traduzione
 * iframe-offset già usata da OverlayLayer per hover/selezione — nessuna
 * nuova matematica di posizionamento.
 */
export function BlockToolbarOverlay({
  iframeRef,
  block,
  descriptor,
  rect,
  isRootLevel,
  canMoveUp,
  canMoveDown,
  registry,
  categories,
  onChangeProp,
  typeStyle,
  onChangeTypeStyle,
  onChangeInstanceStyle,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onInsertBefore,
  onInsertAfter,
  onAddChild,
}: BlockToolbarOverlayProps) {
  const { t } = useTranslation();
  const geometry = useIframeGeometry(iframeRef);
  const [insertOpen, setInsertOpen] = useState<'before' | 'after' | null>(null);

  const canAddChild =
    descriptor.isContainer && descriptor.allowedChildTypes?.length === 1;
  const stylableProperties = descriptor.stylableProperties ?? [];
  const canStyleType =
    stylableProperties.length > 0 &&
    typeStyle !== undefined &&
    onChangeTypeStyle !== undefined;
  const canStyleInstance = stylableProperties.length > 0;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <div
        data-testid="block-breadcrumb"
        className="pointer-events-auto flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow-sm"
        style={toPillStyle(geometry, rect)}
      >
        {descriptor.label}
      </div>

      {isRootLevel && (
        <Popover
          open={insertOpen === 'before'}
          onOpenChange={(open) => setInsertOpen(open ? 'before' : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
              style={toInsertPointStyle(geometry, rect, 'top')}
              aria-label={t('canvas.insertBlock')}
            >
              <Plus size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent>
            <BlockPicker
              categories={categories}
              registry={registry}
              onInsert={(picked) => {
                onInsertBefore(picked);
                setInsertOpen(null);
              }}
            />
          </PopoverContent>
        </Popover>
      )}

      <div
        className="pointer-events-auto flex flex-col gap-1 rounded border bg-background p-1 shadow-md"
        style={toToolbarStyle(geometry, rect)}
      >
        <button
          type="button"
          className={iconButtonClass}
          disabled={!isRootLevel || !canMoveUp}
          onClick={onMoveUp}
          aria-label={t('canvas.moveUp')}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          className={iconButtonClass}
          disabled={!isRootLevel || !canMoveDown}
          onClick={onMoveDown}
          aria-label={t('canvas.moveDown')}
        >
          <ChevronDown size={16} />
        </button>
        {canStyleType && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={iconButtonClass}
                aria-label={t('canvas.style.editType', {
                  type: descriptor.label,
                })}
              >
                <Paintbrush size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right">
              <p className="mb-3 text-xs text-muted-foreground">
                {t('canvas.style.editTypeHint', { type: descriptor.label })}
              </p>
              <BlockStyleFields
                properties={stylableProperties}
                value={typeStyle ?? {}}
                onChange={(next) => onChangeTypeStyle?.(next)}
              />
            </PopoverContent>
          </Popover>
        )}
        {canStyleInstance && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={iconButtonClass}
                aria-label={t('canvas.style.editInstance')}
              >
                <Palette size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right">
              <BlockStyleFields
                properties={stylableProperties}
                value={block.styleOverride ?? {}}
                onChange={onChangeInstanceStyle}
              />
            </PopoverContent>
          </Popover>
        )}
        {descriptor.fields.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={iconButtonClass}
                aria-label={t('canvas.editProperties')}
              >
                <Pencil size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              className="w-104 max-h-[min(32rem,80vh)] overflow-y-auto"
            >
              <InspectorPanel
                block={block}
                descriptor={descriptor}
                onChangeProp={onChangeProp}
              />
            </PopoverContent>
          </Popover>
        )}
        <button
          type="button"
          className={iconButtonClass}
          onClick={onDuplicate}
          aria-label={t('canvas.duplicateBlock')}
        >
          <Copy size={16} />
        </button>
        <button
          type="button"
          className={
            iconButtonClass + ' text-destructive hover:text-destructive'
          }
          onClick={onDelete}
          aria-label={t('canvas.removeBlock')}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {isRootLevel && (
        <Popover
          open={insertOpen === 'after'}
          onOpenChange={(open) => setInsertOpen(open ? 'after' : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
              style={toInsertPointStyle(geometry, rect, 'bottom')}
              aria-label={t('canvas.insertBlock')}
            >
              <Plus size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent>
            <BlockPicker
              categories={categories}
              registry={registry}
              onInsert={(picked) => {
                onInsertAfter(picked);
                setInsertOpen(null);
              }}
            />
          </PopoverContent>
        </Popover>
      )}

      {canAddChild && onAddChild && (
        <button
          type="button"
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
          style={toAddChildStyle(geometry, rect)}
          onClick={onAddChild}
          aria-label={t('canvas.addChild')}
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}
