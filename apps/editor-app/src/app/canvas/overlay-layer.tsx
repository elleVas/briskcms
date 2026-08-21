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

interface IframeGeometry {
  top: number;
  left: number;
  width: number;
}

const ZERO_GEOMETRY: IframeGeometry = { top: 0, left: 0, width: 0 };

/**
 * Ogni `BlockRect` arriva viewport-relative rispetto al DOCUMENTO DENTRO
 * l'iframe (stessa semantica di `getBoundingClientRect()`, vedi
 * apps/public-site/src/lib/get-block-rect.ts) — va sommato alla posizione
 * dell'iframe stesso nella pagina del genitore per disegnare l'overlay nel
 * punto giusto.
 */
export function toOverlayStyle(
  geometry: IframeGeometry,
  rect: BlockRect,
): CSSProperties {
  return {
    position: 'absolute',
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
    position: 'absolute',
    top: geometry.top + top - 1,
    left: geometry.left,
    width: geometry.width,
    height: 2,
  };
}

/** Ricalcola la posizione/larghezza dell'iframe nel documento del genitore ad ogni resize/scroll — l'overlay altrimenti va alla deriva se la pagina del genitore stesso scrolla. */
function useIframeGeometry(
  iframeRef: RefObject<HTMLIFrameElement | null>,
): IframeGeometry {
  const [geometry, setGeometry] = useState<IframeGeometry>(ZERO_GEOMETRY);

  useEffect(() => {
    function recompute(): void {
      const rect = iframeRef.current?.getBoundingClientRect();
      if (rect) {
        setGeometry({ top: rect.top, left: rect.left, width: rect.width });
      }
    }
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
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
