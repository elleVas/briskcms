import { useEffect, useRef } from 'react';

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

interface TurnstileGlobal {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/**
 * Un solo `<script>` per l'intera app, indipendentemente da quanti
 * `TurnstileWidget` montano/smontano (login + password dimenticata possono
 * alternarsi nella stessa sessione, vedi routes/login.tsx) — un secondo
 * `<script src>` identico ricaricherebbe l'intera libreria inutilmente.
 */
function loadTurnstileScript(onLoad: () => void): void {
  if (window.turnstile) {
    onLoad();
    return;
  }
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${SCRIPT_SRC}"]`,
  );
  if (existing) {
    existing.addEventListener('load', onLoad, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.addEventListener('load', onLoad, { once: true });
  document.head.append(script);
}

export interface TurnstileWidgetProps {
  siteKey: string;
  /** `null` su scadenza/errore — il chiamante deve ridisabilitare il submit finché non arriva un nuovo token. */
  onToken: (token: string | null) => void;
  /**
   * Incrementato dal chiamante per forzare un nuovo challenge (security
   * review 2026-08-24, punto 13) — un token Turnstile è single-use: dopo un
   * login/reset rifiutato dal server, il widget mostra ancora visivamente
   * "verificato" ma quel token specifico non è più spendibile. Senza un
   * reset esplicito l'utente resterebbe bloccato a riprovare con un token
   * morto.
   */
  resetSignal?: number;
}

/**
 * Wrapper minimo attorno allo script `window.turnstile` di Cloudflare — non
 * un pacchetto React dedicato (nessuno già in uso nel repo, e il resto
 * dell'integrazione Turnstile in questo progetto è già "script diretto",
 * vedi apps/public-site/src/components/blocks/Form.astro).
 */
export function TurnstileWidget({
  siteKey,
  onToken,
  resetSignal,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function render(): void {
      if (cancelled || !containerRef.current || !window.turnstile) {
        return;
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      });
    }

    loadTurnstileScript(render);

    return () => {
      cancelled = true;
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onToken` è ricreata ad ogni render del chiamante (una closure su `setState`); includerla rimonterebbe il widget (e ne richiederebbe uno nuovo a Cloudflare) ad ogni digitazione nel form.
  }, [siteKey]);

  const isFirstResetRun = useRef(true);
  useEffect(() => {
    // Salta il mount: un reset qui non farebbe nulla di utile (il widget
    // deve ancora completare il PRIMO challenge) e romperebbe l'unico
    // scopo di questo effect — reagire a un cambio DOPO il mount, non al
    // valore iniziale di resetSignal.
    if (isFirstResetRun.current) {
      isFirstResetRun.current = false;
      return;
    }
    if (resetSignal !== undefined && widgetIdRef.current) {
      window.turnstile?.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  return <div ref={containerRef} />;
}
