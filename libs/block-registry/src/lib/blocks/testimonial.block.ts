import type { TestimonialProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { MediaPickerField } from '../fields/media-picker-field';
import { BlockStyleRegistry } from '../block-style-registry';

export const testimonialBlock: BlockDescriptor<TestimonialProps> = {
  type: 'Testimonial',
  label: 'blocks.testimonial.label',
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
      translatable: true,
      label: 'blocks.testimonial.fields.quote.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'author',
      label: 'blocks.testimonial.fields.author.fieldLabel',
      inlineEditable: true,
    },
    {
      kind: 'text',
      key: 'role',
      translatable: true,
      label: 'blocks.testimonial.fields.role.fieldLabel',
      inlineEditable: true,
    },
    FieldBuilder.custom(
      'avatar',
      'blocks.testimonial.fields.avatar.fieldLabel',
      MediaPickerField,
    ),
    {
      kind: 'number',
      key: 'rating',
      label: 'blocks.testimonial.fields.rating.fieldLabel',
      min: 1,
      max: 5,
      step: 1,
    },
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Testimonial,
};
