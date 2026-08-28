import type { BlockBehavior } from './types.js';

// Idempotency guard: re-running this on an already-wired slider would
// attach a second pair of click listeners to the same nav buttons. See
// run-block-behaviors.ts.
const INITIALIZED_ATTR = 'data-brisk-slider-initialized';

function wireImageSlider(slider: HTMLElement): void {
  if (slider.hasAttribute(INITIALIZED_ATTR)) return;
  slider.setAttribute(INITIALIZED_ATTR, '');

  // Native CSS scroll-snap already makes this swipeable/scrollable with no
  // JS at all — the prev/next buttons are a progressive-enhancement layer
  // on top (scrollBy one track width), not the only way to move it.
  const track = slider.querySelector<HTMLDivElement>('.brisk-slider__track');
  if (!track) return;

  const scrollByOneSlide = (direction: 1 | -1) => {
    track.scrollBy({
      left: direction * track.clientWidth,
      behavior: 'smooth',
    });
  };

  slider
    .querySelector('.brisk-slider__nav--prev')
    ?.addEventListener('click', () => scrollByOneSlide(-1));
  slider
    .querySelector('.brisk-slider__nav--next')
    ?.addEventListener('click', () => scrollByOneSlide(1));
}

export const imageSliderBehaviors: BlockBehavior[] = [
  { selector: '.brisk-slider', wire: wireImageSlider },
];
