import type { FormBlockProps } from '@brisk/shared-types';
import { customField, type BlockDescriptor } from '../field-types.js';
import { FormPickerField } from '../fields/form-picker-field.js';

export const formBlock: BlockDescriptor<FormBlockProps> = {
  type: 'Form',
  label: 'Modulo',
  category: 'conversion',
  defaultProps: {
    form: null,
  },
  fields: [customField('form', 'Modulo', FormPickerField)],
  stylableProperties: [
    'backgroundColor',
    'textColor',
    'borderRadius',
    'paddingX',
    'paddingY',
  ],
};
