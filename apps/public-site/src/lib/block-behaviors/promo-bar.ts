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
      // Storage unavailable (a sandboxed preview) — dismissing still
      // takes visual effect for this page load, see below.
    }
    bar.style.display = 'none';
  });
}

export const promoBarBehaviors: BlockBehavior[] = [
  { selector: '.brisk-promo-bar', wire: wirePromoBar },
];
