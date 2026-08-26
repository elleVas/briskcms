import { useEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { createPagePreviewToken } from '../../lib/preview-token-api-client.js';
import { PUBLIC_SITE_URL } from '../../lib/public-site-url.js';
import { BREAKPOINT_WIDTHS, type Breakpoint } from './breakpoint-selector.js';
import { OverlayLayer } from './overlay-layer.js';
import type { PreviewBridgeState } from './use-preview-bridge.js';

export type EditingSection = 'header' | 'footer';

export interface CanvasFrameProps {
  /**
   * Sempre l'id di UNA PAGINA, anche quando si sta editando header/footer
   * (vedi il piano dell'editor visuale, Giorno 1: "la stessa rotta di
   * preview pagina basta") — `editingSection` distingue i due casi, il
   * chiamante (canvas-editor-shell.tsx) sceglie quale pagina usare come
   * contesto quando il context è 'header'/'footer'.
   */
  pageId: string;
  editingSection?: EditingSection;
  /**
   * Il ref dell'iframe è del CHIAMANTE (canvas-editor-shell.tsx), non di
   * questo componente: sia l'Inspector/Layers-panel che l'overlay hanno
   * bisogno dello stesso usePreviewBridge — un'unica istanza dell'hook,
   * una sola sottoscrizione a `message`, invece di due bridge indipendenti
   * che ascoltano lo stesso iframe.
   */
  iframeRef: RefObject<HTMLIFrameElement | null>;
  bridge: PreviewBridgeState;
  /** Calcolato dal chiamante (compute-drop-target.ts) durante un riordino diretto sul canvas — questo componente non conosce `Block[]`, si limita a inoltrarlo all'overlay. */
  dropIndicatorTop?: number | null;
  /** `undefined`/`'desktop'` = piena larghezza (comportamento di sempre). L'overlay non ha bisogno di sapere nulla di questo: la sua geometria è già tracciata dal box reale dell'iframe (vedi `useIframeGeometry`), non dal contenitore attorno. */
  breakpoint?: Breakpoint;
}

/** Esportata per essere testata in isolamento — il pezzo che compone URL, token ed editingSection nell'unico posto in cui vanno assemblati. */
export function buildPreviewUrl(
  pageId: string,
  token: string,
  editingSection?: EditingSection,
): string {
  const params = new URLSearchParams({ token });
  if (editingSection) {
    params.set('editingSection', editingSection);
  }
  return `${PUBLIC_SITE_URL}/preview/${pageId}?${params.toString()}`;
}

/**
 * L'iframe e il suo ciclo di vita (vedi il piano dell'editor visuale,
 * Giorno 2) — un token di preview nuovo ad ogni mount/cambio pagina (TTL
 * corto, non pensato per sopravvivere a lungo), poi l'overlay di
 * hover/selezione sopra, alimentato dal bridge del chiamante.
 * Niente `allow-same-origin` nel sandbox: il contenuto renderizzato qui
 * dentro include blocchi/script inseriti da utenti della piattaforma
 * (non fidati), quindi `allow-scripts` da solo li lascia girare ma con
 * un'origine opaca — combinato ad `allow-same-origin` neutralizzerebbe la
 * sandbox stessa. La comunicazione col genitore resta comunque intatta:
 * passa solo via postMessage (vedi use-preview-bridge.ts), che non
 * richiede same-origin.
 */
export function CanvasFrame({
  pageId,
  editingSection,
  iframeRef,
  bridge,
  dropIndicatorTop,
  breakpoint = 'desktop',
}: CanvasFrameProps) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createPagePreviewToken(pageId)
      .then((preview) => {
        if (!cancelled) {
          setSrc(buildPreviewUrl(pageId, preview.token, editingSection));
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setError(t('canvas.previewTokenError'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, editingSection, t]);

  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>;
  }

  const width = BREAKPOINT_WIDTHS[breakpoint];

  return (
    <div className="h-full w-full overflow-auto bg-muted/30">
      <div
        className="relative mx-auto h-full overflow-hidden bg-background"
        style={width ? { width } : { width: '100%' }}
      >
        {src && (
          <iframe
            ref={iframeRef}
            src={src}
            title={t('canvas.previewFrameTitle')}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-forms"
          />
        )}
        <OverlayLayer
          iframeRef={iframeRef}
          blockRects={bridge.blockRects}
          hoveredBlockId={bridge.hoveredBlockId}
          selectedBlockId={bridge.selectedBlockId}
          dropIndicatorTop={dropIndicatorTop}
        />
      </div>
    </div>
  );
}
