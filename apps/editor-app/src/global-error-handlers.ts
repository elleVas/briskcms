/**
 * Security review 2026-08-24, "terzo giro": nessun `window.onerror`/
 * `unhandledrejection` globale — un throw fuori da un error boundary React
 * (un reject non gestito, un errore in un event handler nativo) spariva
 * nel nulla, invisibile anche in produzione. Nessun servizio di error
 * tracking esterno è configurato (richiede l'account/DSN del cliente,
 * fuori scope qui) — logga in console per ora, unico punto di aggancio
 * per un futuro Sentry.init()/captureException.
 */
export function setupGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    console.error('[unhandled error]', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[unhandled rejection]', event.reason);
  });
}
