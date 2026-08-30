import type { BlockBehavior } from './types';

// Idempotency guard: re-running this would attach a second click listener
// to the same close button. See run-block-behaviors.ts.
const INITIALIZED_ATTR = 'data-brisk-promo-bar-initialized';

function wirePromoBar(bar: HTMLElement): void {
  if (bar.hasAttribute(INITIALIZED_ATTR)) return;
  bar.setAttribute(INITIALIZED_ATTR, '');

  const closeButton = bar.querySelector<HTMLButtonElement>(
    '.brisk-promo-bar__close',
  );
  closeButton?.addEventListener('click', () => {
    try {
      localStorage.setItem('brisk-promo-bar-dismissed', 'true');
    } catch {
      // Storage non disponibile (anteprima sandboxata) — la chiusura
      // resta comunque visiva per questo caricamento, vedi sotto.
    }
    bar.style.display = 'none';
  });
}

export const promoBarBehaviors: BlockBehavior[] = [
  { selector: '.brisk-promo-bar', wire: wirePromoBar },
];
