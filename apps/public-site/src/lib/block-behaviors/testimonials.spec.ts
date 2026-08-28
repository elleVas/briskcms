// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { testimonialsBehaviors } from './testimonials.js';
import { runBlockBehaviors } from './run-block-behaviors.js';

function renderCarousel(): HTMLElement {
  document.body.innerHTML = `
    <div class="brisk-testimonials">
      <div class="brisk-testimonials__track">
        <div class="brisk-testimonial"></div>
      </div>
      <button class="brisk-testimonials__nav--prev" type="button"></button>
      <button class="brisk-testimonials__nav--next" type="button"></button>
    </div>
  `;
  return document.querySelector<HTMLElement>('.brisk-testimonials')!;
}

describe('testimonialsBehaviors', () => {
  it('scrolls the track forward/backward on nav click', () => {
    const root = renderCarousel();
    const track = root.querySelector<HTMLDivElement>(
      '.brisk-testimonials__track',
    )!;
    const scrollBy = vi.fn();
    track.scrollBy = scrollBy;

    runBlockBehaviors(document, testimonialsBehaviors);

    root
      .querySelector<HTMLButtonElement>('.brisk-testimonials__nav--next')!
      .click();
    expect(scrollBy).toHaveBeenCalledTimes(1);

    root
      .querySelector<HTMLButtonElement>('.brisk-testimonials__nav--prev')!
      .click();
    expect(scrollBy).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the carousel has no track', () => {
    document.body.innerHTML = '<div class="brisk-testimonials"></div>';

    expect(() =>
      runBlockBehaviors(document, testimonialsBehaviors),
    ).not.toThrow();
  });

  it('is idempotent: a second run does not double-fire on click', () => {
    const root = renderCarousel();
    const track = root.querySelector<HTMLDivElement>(
      '.brisk-testimonials__track',
    )!;
    const scrollBy = vi.fn();
    track.scrollBy = scrollBy;

    runBlockBehaviors(document, testimonialsBehaviors);
    runBlockBehaviors(document, testimonialsBehaviors);
    root
      .querySelector<HTMLButtonElement>('.brisk-testimonials__nav--next')!
      .click();

    expect(scrollBy).toHaveBeenCalledTimes(1);
  });
});
