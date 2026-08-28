// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { imageSliderBehaviors } from './image-slider.js';
import { runBlockBehaviors } from './run-block-behaviors.js';

function renderSlider(): HTMLElement {
  document.body.innerHTML = `
    <div class="brisk-slider">
      <div class="brisk-slider__track"></div>
      <button class="brisk-slider__nav--prev" type="button"></button>
      <button class="brisk-slider__nav--next" type="button"></button>
    </div>
  `;
  return document.querySelector<HTMLElement>('.brisk-slider')!;
}

describe('imageSliderBehaviors', () => {
  it('scrolls the track forward/backward on nav click', () => {
    const root = renderSlider();
    const track = root.querySelector<HTMLDivElement>('.brisk-slider__track')!;
    const scrollBy = vi.fn();
    track.scrollBy = scrollBy;

    runBlockBehaviors(document, imageSliderBehaviors);

    root.querySelector<HTMLButtonElement>('.brisk-slider__nav--next')!.click();
    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: expect.any(Number) }),
    );

    root.querySelector<HTMLButtonElement>('.brisk-slider__nav--prev')!.click();
    expect(scrollBy).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the slider has no track', () => {
    document.body.innerHTML = '<div class="brisk-slider"></div>';

    expect(() =>
      runBlockBehaviors(document, imageSliderBehaviors),
    ).not.toThrow();
  });

  it('is idempotent: a second run does not double-fire on click', () => {
    const root = renderSlider();
    const track = root.querySelector<HTMLDivElement>('.brisk-slider__track')!;
    const scrollBy = vi.fn();
    track.scrollBy = scrollBy;

    runBlockBehaviors(document, imageSliderBehaviors);
    runBlockBehaviors(document, imageSliderBehaviors);
    root.querySelector<HTMLButtonElement>('.brisk-slider__nav--next')!.click();

    expect(scrollBy).toHaveBeenCalledTimes(1);
  });
});
