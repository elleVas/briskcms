import type { BlockBehavior } from './types.js';

const SCROLL_THRESHOLD = 300;

// Idempotency guard: re-running this would attach a second scroll listener
// and a second click listener to the same button. See
// run-block-behaviors.ts.
const INITIALIZED_ATTR = 'data-brisk-back-to-top-initialized';

function wireBackToTop(button: HTMLElement): void {
  if (
    !(button instanceof HTMLButtonElement) ||
    button.hasAttribute(INITIALIZED_ATTR)
  ) {
    return;
  }
  button.setAttribute(INITIALIZED_ATTR, '');

  const updateVisibility = () => {
    button.classList.toggle(
      'brisk-back-to-top--visible',
      window.scrollY > SCROLL_THRESHOLD,
    );
  };

  updateVisibility();
  window.addEventListener('scroll', updateVisibility, { passive: true });

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

export const backToTopBehaviors: BlockBehavior[] = [
  { selector: '.brisk-back-to-top', wire: wireBackToTop },
];
