import type { BlockBehavior } from './types';

// Idempotency guard: re-running this would attach a second set of
// prev/next/submit listeners to the same form. See
// run-block-behaviors.ts.
const INITIALIZED_ATTR = 'data-brisk-form-initialized';

// One step's <div> visible at a time via the hidden attribute,
// Indietro/Avanti walk the index. Every step's markup stays in the DOM the
// whole time (all fields submit together in one POST at the end, unchanged
// from a flat form); only the currently-visible one is ever validated/
// interactive.
//
// A no-op for a plain single-step form: querySelectorAll('.brisk-form__step')
// finds nothing, the early return below skips the rest for that form.
function wireMultiStepForm(form: HTMLElement): void {
  if (
    !(form instanceof HTMLFormElement) ||
    form.hasAttribute(INITIALIZED_ATTR)
  ) {
    return;
  }

  const steps = Array.from(
    form.querySelectorAll<HTMLElement>('.brisk-form__step'),
  );
  if (steps.length === 0) return;
  form.setAttribute(INITIALIZED_ATTR, '');

  const prevButton = form.querySelector<HTMLButtonElement>('[data-step-prev]');
  const nextButton = form.querySelector<HTMLButtonElement>('[data-step-next]');
  const submitButton =
    form.querySelector<HTMLButtonElement>('[data-step-submit]');
  const indicator = form.querySelector<HTMLElement>('[data-step-indicator]');
  let current = 0;

  function render() {
    steps.forEach((step, index) => {
      step.hidden = index !== current;
    });
    if (prevButton) prevButton.hidden = current === 0;
    if (nextButton) nextButton.hidden = current === steps.length - 1;
    if (submitButton) submitButton.hidden = current !== steps.length - 1;
    if (indicator) {
      const template = indicator.dataset.stepIndicatorTemplate ?? '';
      indicator.textContent = template
        .replace('{current}', String(current + 1))
        .replace('{total}', String(steps.length));
    }
  }

  // Runs the browser's own constraint validation (required, type=email,
  // etc.) on just the step being left, reporting the first failure with
  // the native bubble UI — a required field in an earlier, now-hidden
  // step would otherwise never be checked at all, since browsers skip
  // validating anything inside a hidden element on the final submit.
  function currentStepIsValid(): boolean {
    const fields = steps[current].querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('input, textarea, select');
    for (const field of fields) {
      if (!field.reportValidity()) return false;
    }
    return true;
  }

  function goToNextStep() {
    if (!currentStepIsValid()) return;
    current = Math.min(current + 1, steps.length - 1);
    render();
  }

  nextButton?.addEventListener('click', goToNextStep);
  prevButton?.addEventListener('click', () => {
    current = Math.max(current - 1, 0);
    render();
  });

  // Pressing Enter in a text field fires a real `submit` event — same as
  // clicking the (possibly hidden) submit button — regardless of which
  // field triggered it and regardless of the submit button's own hidden
  // state; confirmed empirically, not assumed. Intercepted here instead
  // of relying on the submit button being unreachable, so Enter on any
  // step but the last one just advances a step, exactly like clicking
  // Avanti, rather than submitting mid-wizard.
  form.addEventListener('submit', (event) => {
    if (current !== steps.length - 1) {
      event.preventDefault();
      goToNextStep();
    }
  });

  render();
}

export const formBehaviors: BlockBehavior[] = [
  { selector: '.brisk-form form', wire: wireMultiStepForm },
];
