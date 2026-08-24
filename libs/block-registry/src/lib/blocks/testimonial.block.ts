import type { TestimonialProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { MediaPickerField } from '../fields/media-picker-field.js';

export const testimonialBlock: BlockDescriptor<TestimonialProps> = {
  type: 'Testimonial',
  label: 'Testimonianza',
  category: 'socialProof',
  defaultProps: {
    quote: 'Testo della recensione...',
    author: 'Nome Cognome',
    role: '',
    avatar: null,
    rating: 5,
  },
  fields: [
    {
      kind: 'textarea',
      key: 'quote',
      label: 'Recensione',
      inlineEditable: true,
    },
    { kind: 'text', key: 'author', label: 'Autore', inlineEditable: true },
    { kind: 'text', key: 'role', label: 'Ruolo', inlineEditable: true },
    customField('avatar', 'Avatar', MediaPickerField),
    { kind: 'number', key: 'rating', label: 'Stelle', min: 1, max: 5, step: 1 },
  ],
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
  defaultStyle: BLOCK_STYLE_DEFAULTS.Testimonial,
};
