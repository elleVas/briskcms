import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import type { BlockRect } from '@brisk/shared-types';

export interface OverlayLayerProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  blockRects: BlockRect[];
  hoveredBlockId: string | null;
  selectedBlockId: string | null;
  /** Y (iframe-relative, vedi compute-drop-target.ts) su cui disegnare la linea di drop durante un riordino diretto sul canvas — `null`/assente quando nessun drag è in corso. */
  dropIndicatorTop?: number | null;
}

export interface IframeGeometry {
  top: number;
  left: number;
  width: number;
  height: number;
}

const ZERO_GEOMETRY: IframeGeometry = { top: 0, left: 0, width: 0, height: 0 };

/**
 * `rect` è viewport-relative DENTRO l'iframe (stesso sistema di coordinate
 * di `getBoundingClientRect()` lì dentro) — resta valido anche quando il
 * blocco è scrollato fuori dalla parte visibile dell'iframe (una pagina
 * lunga scrolla DENTRO l'iframe stesso, che ha un'altezza fissa, vedi
 * canvas-frame.tsx). Senza questo controllo, un overlay `position: fixed`
 * (bordo di selezione, indicatore di drop, o l'intera toolbar contestuale)
 * per un blocco così finiva renderizzato fuori dal riquadro del canvas,
 * sopra il resto della pagina dell'editor — bug trovato dal vivo popolando
 * un contenitore in fondo a una pagina lunga: il pulsante "Aggiungi
 * elemento" appariva staccato, lontano dal contenitore a cui apparteneva.
 *
 * `geometry` ancora a `ZERO_GEOMETRY` (mai misurata — al primo render,
 * prima che `useIframeGeometry` trovi l'iframe nel DOM, o in jsdom nei test
 * che non mockano `getBoundingClientRect`) è trattata come "visibilità
 * sconosciuta" e passa sempre: un falso negativo qui (nascondere la toolbar
 * quando in realtà l'iframe è a piena dimensione ma non ancora misurato)
 * sarebbe peggio del falso positivo opposto.
 */
export function isRectVisibleInIframe(
  geometry: IframeGeometry,
  rect: { top: number; left: number; width: number; height: number },
): boolean {
  if (geometry.width === 0 && geometry.height === 0) {
    return true;
  }
  return (
    rect.top + rect.height > 0 &&
    rect.top < geometry.height &&
    rect.left + rect.width > 0 &&
    rect.left < geometry.width
  );
}

/**
 * Ogni `BlockRect` arriva viewport-relative rispetto al DOCUMENTO DENTRO
 * l'iframe (stessa semantica di `getBoundingClientRect()`, vedi
 * apps/public-site/src/lib/get-block-rect.ts) — va sommato alla posizione
 * dell'iframe stesso nella pagina del genitore per disegnare l'overlay nel
 * punto giusto.
 */
/**
 * `position: 'fixed'`, non `'absolute'` — l'overlay vive dentro un
 * contenitore che di per sé è già co-locato con il box dell'iframe (nessun
 * padding/margine fra i due), quindi un `absolute` sommerebbe l'offset
 * dell'iframe una seconda volta sopra quello già dato dal genitore
 * posizionato. `fixed` ignora la gerarchia degli antenati e usa
 * direttamente le coordinate viewport di `geometry`/`rect` (stessa
 * semantica di `getBoundingClientRect()`), l'unica cosa per cui la
 * traduzione qui sotto è corretta.
 */
export function toOverlayStyle(
  geometry: IframeGeometry,
  rect: BlockRect,
): CSSProperties {
  return {
    position: 'fixed',
    top: geometry.top + rect.top,
    left: geometry.left + rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/** Stessa traduzione di `toOverlayStyle` ma per una linea orizzontale a tutta larghezza dell'iframe invece di un box — l'indicatore di drop del riordino diretto sul canvas. */
export function toDropIndicatorStyle(
  geometry: IframeGeometry,
  top: number,
): CSSProperties {
  return {
    position: 'fixed',
    top: geometry.top + top - 1,
    left: geometry.left,
    width: geometry.width,
    height: 2,
  };
}

/**
 * Ricalcola la posizione/larghezza dell'iframe nel documento del genitore
 * ad ogni resize/scroll — l'overlay altrimenti va alla deriva se la pagina
 * del genitore stesso scrolla. Esportata: `block-toolbar-overlay.tsx` la
 * condivide invece di ricalcolare la stessa cosa una seconda volta.
 */
export function useIframeGeometry(
  iframeRef: RefObject<HTMLIFrameElement | null>,
): IframeGeometry {
  const [geometry, setGeometry] = useState<IframeGeometry>(ZERO_GEOMETRY);

  useEffect(() => {
    let resizeObserver: ResizeObserver | undefined;
    let rafId: number | undefined;

    function recompute(): void {
      const rect = iframeRef.current?.getBoundingClientRect();
      if (rect) {
        setGeometry({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    }

    /**
     * CanvasFrame monta l'`<iframe>` solo dopo che il token di preview
     * arriva (async) — al primo run di questo effect `iframeRef.current`
     * è quasi sempre ancora `null`. Senza questo retry `recompute()` non
     * troverebbe nulla e resterebbe bloccato su ZERO_GEOMETRY per sempre
     * (i listener di resize/scroll da soli non se ne accorgono, perché
     * nessuno dei due si attiva quando l'iframe compare in seguito).
     */
    function attach(): void {
      const el = iframeRef.current;
      if (!el) {
        rafId = requestAnimationFrame(attach);
        return;
      }
      recompute();
      resizeObserver = new ResizeObserver(recompute);
      resizeObserver.observe(el);
    }

    attach();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [iframeRef]);

  return geometry;
}

/**
 * Disegna il box di hover/selezione sopra l'iframe — sola lettura per ora
 * (Giorno 2): nessuna interazione propria, mostra solo lo stato che arriva
 * dal bridge (usePreviewBridge). `pointer-events-none` sul contenitore
 * lascia passare ogni click/hover reale fino all'iframe sottostante.
 */
export function OverlayLayer({
  iframeRef,
  blockRects,
  hoveredBlockId,
  selectedBlockId,
  dropIndicatorTop,
}: OverlayLayerProps) {
  const geometry = useIframeGeometry(iframeRef);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {blockRects.map((rect) => {
        const isSelected = rect.id === selectedBlockId;
        const isHovered = rect.id === hoveredBlockId;
        if (!isSelected && !isHovered) {
          return null;
        }
        if (!isRectVisibleInIframe(geometry, rect)) {
          return null;
        }
        return (
          <div
            key={rect.id}
            data-testid="overlay-box"
            data-block-id={rect.id}
            data-state={isSelected ? 'selected' : 'hovered'}
            className={
              isSelected
                ? 'absolute rounded-sm border-2 border-primary'
                : 'absolute rounded-sm border-2 border-primary/50'
            }
            style={toOverlayStyle(geometry, rect)}
          />
        );
      })}
      {dropIndicatorTop != null && (
        <div
          data-testid="drop-indicator"
          className="absolute rounded-full bg-primary"
          style={toDropIndicatorStyle(geometry, dropIndicatorTop)}
        />
      )}
    </div>
  );
}
