import type { BlockBehavior } from './types';

// Idempotency guard: re-running this on an already-wired toggle would
// attach a second click listener (and a second document-level
// keydown/click listener) — a single click would then open then
// immediately re-close the same menu. See run-block-behaviors.ts.
const INITIALIZED_ATTR = 'data-brisk-hamburger-initialized';

function wireHamburgerMenu(root: HTMLElement): void {
  const toggle = root.querySelector<HTMLButtonElement>(
    '.brisk-hamburger__toggle',
  );
  if (!toggle || toggle.hasAttribute(INITIALIZED_ATTR)) return;
  toggle.setAttribute(INITIALIZED_ATTR, '');

  function setOpen(isOpen: boolean) {
    root.classList.toggle('brisk-hamburger--open', isOpen);
    toggle?.setAttribute('aria-expanded', String(isOpen));
    const label = isOpen
      ? toggle?.dataset.labelClose
      : toggle?.dataset.labelOpen;
    if (label) toggle?.setAttribute('aria-label', label);
  }

  toggle.addEventListener('click', () => {
    setOpen(!root.classList.contains('brisk-hamburger--open'));
  });

  // Security review 2026-08-24, accessibility: neither Esc nor a click
  // outside the panel closed it before — only re-clicking the toggle
  // itself did.
  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      root.classList.contains('brisk-hamburger--open')
    ) {
      setOpen(false);
      toggle?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (
      root.classList.contains('brisk-hamburger--open') &&
      !root.contains(event.target as Node)
    ) {
      setOpen(false);
    }
  });
}

export const hamburgerMenuBehaviors: BlockBehavior[] = [
  { selector: '.brisk-hamburger', wire: wireHamburgerMenu },
];
