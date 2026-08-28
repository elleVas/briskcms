import type { BlockBehavior } from './types.js';

// Idempotency guard: re-running this would attach a second 'input'
// listener to the same slider. See run-block-behaviors.ts.
const INITIALIZED_ATTR = 'data-brisk-before-after-initialized';

function wireBeforeAfter(container: HTMLElement): void {
  if (container.hasAttribute(INITIALIZED_ATTR)) return;
  container.setAttribute(INITIALIZED_ATTR, '');

  const slider = container.querySelector<HTMLInputElement>(
    '.brisk-before-after__slider',
  );
  slider?.addEventListener('input', () => {
    container.style.setProperty('--reveal', `${slider.value}%`);
  });
}

export const beforeAfterBehaviors: BlockBehavior[] = [
  { selector: '.brisk-before-after', wire: wireBeforeAfter },
];
