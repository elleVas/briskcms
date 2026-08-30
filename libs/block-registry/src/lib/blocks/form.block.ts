import type { FormBlockProps } from '@brisk/shared-types';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { FieldBuilder, type BlockDescriptor } from '../field-types';
import { FormPickerField } from '../fields/form-picker-field';
import { BlockStyleRegistry } from '../block-style-registry';

export const formBlock: BlockDescriptor<FormBlockProps> = {
  type: 'Form',
  label: 'blocks.form.label',
  category: 'conversion',
  defaultProps: {
    form: null,
  },
  fields: [
    FieldBuilder.custom(
      'form',
      'blocks.form.fields.form.fieldLabel',
      FormPickerField,
    ),
  ],
  stylableProperties: BlockStyleRegistry.STANDARD,
  defaultStyle: BLOCK_STYLE_DEFAULTS.Form,
};
