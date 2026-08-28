// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formBehaviors } from './form.js';
import { runBlockBehaviors } from './run-block-behaviors.js';

function renderMultiStepForm(): HTMLFormElement {
  document.body.innerHTML = `
    <div class="brisk-form">
      <form>
        <p data-step-indicator data-step-indicator-template="Passo {current} di {total}"></p>
        <div class="brisk-form__step" data-step-index="0">
          <input type="text" required />
        </div>
        <div class="brisk-form__step" data-step-index="1" hidden>
          <input type="text" />
        </div>
        <div class="brisk-form__step-nav">
          <button type="button" data-step-prev>Indietro</button>
          <button type="button" data-step-next>Avanti</button>
        </div>
        <button type="submit" data-step-submit hidden>Invia</button>
      </form>
    </div>
  `;
  return document.querySelector<HTMLFormElement>('.brisk-form form')!;
}

describe('formBehaviors', () => {
  it('is a no-op for a plain single-step form', () => {
    document.body.innerHTML = `
      <div class="brisk-form"><form><button type="submit">Invia</button></form></div>
    `;

    expect(() => runBlockBehaviors(document, formBehaviors)).not.toThrow();
  });

  it('shows only the first step and the indicator text on init', () => {
    renderMultiStepForm();

    runBlockBehaviors(document, formBehaviors);

    const steps = document.querySelectorAll<HTMLElement>('.brisk-form__step');
    expect(steps[0].hidden).toBe(false);
    expect(steps[1].hidden).toBe(true);
    expect(document.querySelector('[data-step-indicator]')?.textContent).toBe(
      'Passo 1 di 2',
    );
  });

  it('does not advance past a required field left empty', () => {
    renderMultiStepForm();
    runBlockBehaviors(document, formBehaviors);

    document.querySelector<HTMLInputElement>(
      '.brisk-form__step[data-step-index="0"] input',
    )!.reportValidity = () => false;
    document.querySelector<HTMLButtonElement>('[data-step-next]')!.click();

    const steps = document.querySelectorAll<HTMLElement>('.brisk-form__step');
    expect(steps[0].hidden).toBe(false);
    expect(steps[1].hidden).toBe(true);
  });

  it('advances to the next step and shows the submit button on the last one', () => {
    renderMultiStepForm();
    runBlockBehaviors(document, formBehaviors);
    document.querySelector<HTMLInputElement>(
      '.brisk-form__step[data-step-index="0"] input',
    )!.reportValidity = () => true;

    document.querySelector<HTMLButtonElement>('[data-step-next]')!.click();

    const steps = document.querySelectorAll<HTMLElement>('.brisk-form__step');
    expect(steps[0].hidden).toBe(true);
    expect(steps[1].hidden).toBe(false);
    expect(document.querySelector('[data-step-submit]')).toHaveProperty(
      'hidden',
      false,
    );
    expect(document.querySelector('[data-step-indicator]')?.textContent).toBe(
      'Passo 2 di 2',
    );
  });

  it('goes back a step on Indietro', () => {
    renderMultiStepForm();
    runBlockBehaviors(document, formBehaviors);
    document.querySelector<HTMLInputElement>(
      '.brisk-form__step[data-step-index="0"] input',
    )!.reportValidity = () => true;
    document.querySelector<HTMLButtonElement>('[data-step-next]')!.click();

    document.querySelector<HTMLButtonElement>('[data-step-prev]')!.click();

    const steps = document.querySelectorAll<HTMLElement>('.brisk-form__step');
    expect(steps[0].hidden).toBe(false);
    expect(steps[1].hidden).toBe(true);
  });

  it('is idempotent: a second run does not double-advance on one click', () => {
    renderMultiStepForm();
    runBlockBehaviors(document, formBehaviors);
    runBlockBehaviors(document, formBehaviors);
    document.querySelector<HTMLInputElement>(
      '.brisk-form__step[data-step-index="0"] input',
    )!.reportValidity = () => true;

    document.querySelector<HTMLButtonElement>('[data-step-next]')!.click();

    expect(document.querySelector('[data-step-indicator]')?.textContent).toBe(
      'Passo 2 di 2',
    );
  });
});
