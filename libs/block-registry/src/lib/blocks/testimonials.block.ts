import type { TestimonialsProps } from '@brisk/shared-types';
import type { BlockDescriptor } from '../field-types.js';

export const testimonialsBlock: BlockDescriptor<TestimonialsProps> = {
  type: 'Testimonials',
  label: 'Testimonianze/recensioni',
  category: 'socialProof',
  defaultProps: {},
  fields: [],
  isContainer: true,
  allowedChildTypes: ['Testimonial'],
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
};
