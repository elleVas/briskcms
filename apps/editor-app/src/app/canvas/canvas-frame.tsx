import { useEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createReusableSectionPreviewToken,
  createTranslationPreviewToken,
} from '../../lib/preview-token-api-client';
import { PUBLIC_SITE_URL } from '../../lib/public-site-url';
import { BREAKPOINT_WIDTHS, type Breakpoint } from './breakpoint-selector';
import { OverlayLayer } from './overlay-layer';
import type { PreviewBridgeState } from './use-preview-bridge';

export type EditingSection = 'header' | 'footer';

export interface CanvasFrameProps {
  /**
   * Always the id of ONE PageTranslation (field-level i18n), even while
   * editing the header/footer (see the visual editor plan, Day 1: "the same
   * page-preview route is enough") — `editingSection` distinguishes the two
   * cases, and the caller (canvas-editor-shell.tsx) picks which translation
   * to use as context when the context is 'header'/'footer'.
   */
  pageId: string;
  editingSection?: EditingSection;
  /**
   * Present only in the reusable-section editor (docs/adr/0059). When it
   * is, the canvas shows that section's own draft on its own route and
   * `pageId` is ignored — a section is not on a page, so there is no page
   * to render it against.
   */
  sectionPreview?: { sectionId: string; locale: string };
  /**
   * The iframe's ref belongs to the CALLER (canvas-editor-shell.tsx), not
   * to this component: the Inspector/Layers panel and the overlay both need
   * the same usePreviewBridge — one instance of the hook and one `message`
   * subscription, rather than two independent bridges listening to the same
   * iframe.
   */
  iframeRef: RefObject<HTMLIFrameElement | null>;
  bridge: PreviewBridgeState;
  /** Computed by the caller (compute-drop-target.ts) during a direct canvas reorder — this component knows nothing about `Block[]`, it merely forwards it to the overlay. */
  dropIndicatorTop?: number | null;
  /** `undefined`/`'base'` = full width (the long-standing behaviour). The overlay needs to know nothing about this: its geometry is already tracked from the iframe's real box (see `useIframeGeometry`), not from the container around it. */
  breakpoint?: Breakpoint;
}

/**
 * Exported so it can be tested in isolation — the piece that composes the
 * URL, the token and editingSection in the one place where they belong
 * together.
 *
 * `embedded` distinguishes the two contexts that reuse this same preview
 * route: the canvas iframe (`CanvasFrame` below, `embedded: true`) needs
 * click-to-select — that is the entire point of that iframe — whereas the
 * standalone "Preview" button (canvas-editor-shell.tsx) opens the same URL
 * in an ordinary browser tab, where there is no surrounding editor to send
 * clicks to: without this flag the page still intercepts every click (the
 * same initPreviewBridge()) and navigation comes out broken — a real bug,
 * found while building a site with real header links and reported by the
 * user.
 */
export function buildPreviewUrl(
  pageId: string,
  token: string,
  editingSection?: EditingSection,
  embedded?: boolean,
): string {
  const params = new URLSearchParams({ token });
  if (editingSection) {
    params.set('editingSection', editingSection);
  }
  if (embedded) {
    params.set('embedded', '1');
  }
  return `${PUBLIC_SITE_URL}/preview/${pageId}?${params.toString()}`;
}

/**
 * The section editor's canvas URL. A route of its own rather than a flag
 * on the page preview: the token it carries is minted for a SECTION, and
 * the two are validated separately so neither can be replayed as the
 * other.
 */
export function buildSectionPreviewUrl(
  sectionId: string,
  token: string,
  locale: string,
  embedded?: boolean,
): string {
  const params = new URLSearchParams({ token, locale });
  if (embedded) {
    params.set('embedded', '1');
  }
  return `${PUBLIC_SITE_URL}/preview/sections/${sectionId}?${params.toString()}`;
}

/**
 * The iframe and its lifecycle (see the visual editor plan, Day 2) — a
 * fresh preview token on every mount and page change (short TTL, not meant
 * to survive long), then the hover/selection overlay on top, fed by the
 * caller's bridge.
 * No `allow-same-origin` in the sandbox: the content rendered in here
 * includes blocks and scripts inserted by platform users (untrusted), so
 * `allow-scripts` on its own lets them run but with an opaque origin —
 * combined with `allow-same-origin` it would neutralize the sandbox itself.
 * Communication with the parent stays intact regardless: it goes only
 * through postMessage (see use-preview-bridge.ts), which does not require
 * same-origin.
 * That same opaque origin (`Origin: null`) breaks rendering when `src`
 * points at Astro's dev server (`nx serve public-site`): its internal
 * hardening (>= Astro 6.0) blocks every script and stylesheet the page
 * loads after the initial navigation with a hard 403, with no config option
 * for an opaque origin — this is not a bug in this component. In production
 * (`server.mjs`) that block does not exist. See "Canvas rendering needs
 * public-site's production build" in docs/development.md for the full
 * explanation and the workaround for testing locally.
 */
export function CanvasFrame({
  pageId,
  editingSection,
  sectionPreview,
  iframeRef,
  bridge,
  dropIndicatorTop,
  breakpoint = 'base',
}: CanvasFrameProps) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const minted = sectionPreview
      ? createReusableSectionPreviewToken(sectionPreview.sectionId).then(
          (preview) =>
            buildSectionPreviewUrl(
              sectionPreview.sectionId,
              preview.token,
              sectionPreview.locale,
              true,
            ),
        )
      : createTranslationPreviewToken(pageId).then((preview) =>
          buildPreviewUrl(pageId, preview.token, editingSection, true),
        );
    minted
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
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
  }, [pageId, editingSection, sectionPreview, t]);

  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>;
  }

  const width = BREAKPOINT_WIDTHS[breakpoint];

  return (
    /*
     * The page needs an edge. The stage behind it used to be the same
     * colour as the rest of the app, and the iframe had no border, no
     * radius and no shadow — so the site simply started, mid-screen, at
     * x=256 with nothing to say it had. At a narrow breakpoint it was
     * worse: a centred frame with no frame around it reads as a hole in
     * the page rather than as a phone.
     */
    <div className="h-full w-full overflow-auto bg-canvas-stage">
      <div
        className={
          width
            ? 'relative mx-auto my-4 h-[calc(100%-2rem)] overflow-hidden rounded-lg border bg-background shadow-lg'
            : 'relative mx-auto h-full overflow-hidden rounded-t-lg border border-b-0 bg-background shadow-lg'
        }
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
