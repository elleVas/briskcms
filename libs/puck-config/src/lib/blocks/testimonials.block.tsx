import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import {
  testimonialsPropsSchema,
  type TestimonialsProps,
} from '@brisk/shared-types';
import { EditorChrome } from '../editor-chrome.js';

export { testimonialsPropsSchema, type TestimonialsProps };

// Puck's own slot field needs a `children` prop that isn't part of
// `TestimonialsProps` (the domain schema, empty) — same reasoning as
// column.block.tsx's own `ColumnPuckProps`.
export interface TestimonialsPuckProps {
  children: Slot;
}

const TESTIMONIALS_COLOR = '#db2777';

const fields: Fields<TestimonialsPuckProps> = {
  children: { type: 'slot', allow: ['Testimonial'] },
};

export const testimonialsConfig: ComponentConfig<TestimonialsPuckProps> = {
  label: 'Testimonianze/recensioni',
  fields,
  defaultProps: { children: [] },
  // Canvas preview stacks the cards in a plain flex row — the real
  // scroll-snap carousel with prev/next controls only exists on
  // apps/public-site (Testimonials.astro), same split as ImageSlider.
  render: ({ children: Children }) => (
    <EditorChrome label="Testimonianze/recensioni" color={TESTIMONIALS_COLOR}>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
        <Children />
      </div>
    </EditorChrome>
  ),
};
