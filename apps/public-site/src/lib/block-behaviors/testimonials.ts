import type { BlockBehavior } from './types.js';
import { carouselScrollSign } from './carousel-scroll-direction.js';

// Idempotency guard, same reasoning as image-slider.ts's own.
const INITIALIZED_ATTR = 'data-brisk-testimonials-initialized';

function wireTestimonials(carousel: HTMLElement): void {
  if (carousel.hasAttribute(INITIALIZED_ATTR)) return;
  carousel.setAttribute(INITIALIZED_ATTR, '');

  // Same "native scroll-snap first, buttons as progressive enhancement"
  // pattern as image-slider.ts's own carousel.
  const track = carousel.querySelector<HTMLDivElement>(
    '.brisk-testimonials__track',
  );
  if (!track) return;

  const card = track.querySelector<HTMLElement>('.brisk-testimonial');
  const scrollByOneCard = (direction: 1 | -1) => {
    const width = card?.offsetWidth ?? track.clientWidth;
    track.scrollBy({
      left: carouselScrollSign(track, direction) * (width + 24),
      behavior: 'smooth',
    });
  };

  carousel
    .querySelector('.brisk-testimonials__nav--prev')
    ?.addEventListener('click', () => scrollByOneCard(-1));
  carousel
    .querySelector('.brisk-testimonials__nav--next')
    ?.addEventListener('click', () => scrollByOneCard(1));
}

export const testimonialsBehaviors: BlockBehavior[] = [
  { selector: '.brisk-testimonials', wire: wireTestimonials },
];
